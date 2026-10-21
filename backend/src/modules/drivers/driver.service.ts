import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AuditLog } from '../../database/audit-log.entity';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole, UserStatus } from '../users/user.entity';
import { AvailabilityDto } from './dto/availability.dto';
import { DriverLocationDto } from './dto/location.dto';
import { DriverProfileDto } from './dto/driver-profile.dto';
import { CreateVehicleDto } from './dto/vehicle.dto';
import {
  DriverProfile,
  DriverVerificationStatus,
} from './driver-profile.entity';
import { Vehicle, VehicleVerificationStatus } from './vehicle.entity';
import {
  DriverVerificationDto,
  VehicleVerificationDto,
} from './dto/verification.dto';

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.every((row: unknown) => typeof row === 'object' && row !== null)
  );
}

@Injectable()
export class DriverService {
  private readonly locationMaxAgeSeconds: number;

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.locationMaxAgeSeconds = config.get<number>(
      'DRIVER_LOCATION_MAX_AGE_SECONDS',
      120,
    );
  }

  async profile(user: AuthenticatedUser): Promise<DriverProfile> {
    this.assertDriver(user);
    const profile = await this.dataSource.getRepository(DriverProfile).findOne({
      where: { userId: user.id },
      relations: { vehicles: true },
    });
    if (!profile) {
      throw new NotFoundException('Driver profile has not been submitted');
    }
    return profile;
  }

  async submitProfile(
    user: AuthenticatedUser,
    input: DriverProfileDto,
  ): Promise<DriverProfile> {
    this.assertDriver(user);
    const licenseNumber = input.licenseNumber.trim().toUpperCase();
    if (new Date(input.licenseExpiry) <= new Date()) {
      throw new BadRequestException('Driver license must not be expired');
    }
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(DriverProfile);
      let profile = await repository.findOneBy({ userId: user.id });
      if (profile) {
        profile.licenseNumber = licenseNumber;
        profile.licenseExpiry = input.licenseExpiry;
        profile.verificationStatus = DriverVerificationStatus.PENDING;
        profile.identityVerified = false;
        profile.isOnline = false;
        profile.isAvailable = false;
      } else {
        profile = repository.create({
          userId: user.id,
          licenseNumber,
          licenseExpiry: input.licenseExpiry,
          verificationStatus: DriverVerificationStatus.PENDING,
          identityVerified: false,
          isOnline: false,
          isAvailable: false,
          latitude: null,
          longitude: null,
          locationAccuracyM: null,
          lastLocationAt: null,
        });
      }
      await repository.save(profile);
      await manager.getRepository(AuditLog).insert({
        actorId: user.id,
        eventType: 'driver.profile_submitted',
        targetId: user.id,
        metadata: {},
      });
      return repository.findOneOrFail({
        where: { userId: user.id },
        relations: { vehicles: true },
      });
    });
  }

  async addVehicle(
    user: AuthenticatedUser,
    input: CreateVehicleDto,
  ): Promise<Vehicle> {
    this.assertDriver(user);
    const profile = await this.dataSource
      .getRepository(DriverProfile)
      .findOneBy({ userId: user.id });
    if (!profile) {
      throw new BadRequestException(
        'Submit driver profile before adding a vehicle',
      );
    }
    if (new Date(input.documentExpiresAt) <= new Date()) {
      throw new BadRequestException('Vehicle documents must not be expired');
    }
    const vehicle = this.dataSource.getRepository(Vehicle).create({
      ...input,
      driverId: user.id,
      make: input.make.trim(),
      model: input.model.trim(),
      color: input.color.trim(),
      registrationNumber: input.registrationNumber
        .trim()
        .replace(/\s+/g, '')
        .toUpperCase(),
      verificationStatus: VehicleVerificationStatus.PENDING,
      isActive: true,
    });
    try {
      return await this.dataSource.getRepository(Vehicle).save(vehicle);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'A vehicle with this registration number already exists',
        );
      }
      throw error;
    }
  }

  async vehicles(user: AuthenticatedUser): Promise<Vehicle[]> {
    this.assertDriver(user);
    return this.dataSource.getRepository(Vehicle).find({
      where: { driverId: user.id },
      order: { createdAt: 'DESC' },
    });
  }

  async updateLocation(
    user: AuthenticatedUser,
    input: DriverLocationDto,
  ): Promise<{ updated: true; receivedAt: Date }> {
    this.assertDriver(user);
    const result: unknown = await this.dataSource.query(
      `UPDATE driver_profiles
       SET latitude = $2, longitude = $3, location_accuracy_m = $4,
           last_location_at = now(), updated_at = now()
       WHERE user_id = $1
         AND (last_location_at IS NULL OR
              last_location_at < now() - interval '1 second')
       RETURNING last_location_at`,
      [user.id, input.latitude, input.longitude, input.accuracyMeters ?? null],
    );
    if (!isRecordArray(result)) {
      throw new InternalServerErrorException(
        'Unable to update driver location',
      );
    }
    if (result.length === 0) {
      const exists = await this.dataSource
        .getRepository(DriverProfile)
        .existsBy({ userId: user.id });
      if (!exists) {
        throw new NotFoundException('Submit driver profile first');
      }
      throw new HttpException(
        'Location updates are limited to one per second',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const timestamp = result[0].last_location_at;
    if (!(timestamp instanceof Date) && typeof timestamp !== 'string') {
      throw new InternalServerErrorException(
        'Unable to read the updated driver location',
      );
    }
    return { updated: true, receivedAt: new Date(timestamp) };
  }

  async setAvailability(
    user: AuthenticatedUser,
    input: AvailabilityDto,
  ): Promise<{ online: boolean; available: boolean }> {
    this.assertDriver(user);
    if (input.available && !input.online) {
      throw new BadRequestException(
        'A driver must be online to be available for offers',
      );
    }

    if (!input.online) {
      const update = await this.dataSource
        .getRepository(DriverProfile)
        .update({ userId: user.id }, { isOnline: false, isAvailable: false });
      if (update.affected !== 1) {
        throw new NotFoundException('Submit driver profile first');
      }
      return { online: false, available: false };
    }

    const now = new Date();
    const maxAge = new Date(now.getTime() - this.locationMaxAgeSeconds * 1000);
    const rows: unknown = await this.dataSource.query(
      `UPDATE driver_profiles AS dp
       SET is_online = true, is_available = $2, updated_at = now()
       FROM users AS u
       WHERE dp.user_id = $1 AND u.id = dp.user_id
         AND u.status = 'ACTIVE' AND u.phone_verified_at IS NOT NULL
         AND dp.verification_status = 'APPROVED'
         AND dp.identity_verified = true
         AND dp.latitude IS NOT NULL AND dp.longitude IS NOT NULL
         AND dp.last_location_at > $3
         AND dp.license_expiry > CURRENT_DATE
         AND EXISTS (
           SELECT 1 FROM vehicles v
           WHERE v.driver_id = dp.user_id AND v.is_active = true
             AND v.verification_status = 'APPROVED'
             AND v.document_expires_at > CURRENT_DATE
         )
       RETURNING dp.user_id`,
      [user.id, input.available, maxAge],
    );
    if (!isRecordArray(rows)) {
      throw new InternalServerErrorException(
        'Unable to update driver availability',
      );
    }
    if (rows.length !== 1) {
      const profile = await this.dataSource
        .getRepository(DriverProfile)
        .findOneBy({ userId: user.id });
      if (!profile) {
        throw new NotFoundException('Submit driver profile first');
      }
      throw new ForbiddenException(
        'A verified, active driver with approved current documents, vehicle, and fresh location is required to go online',
      );
    }
    return { online: true, available: input.available };
  }

  async verifyDriver(
    actor: AuthenticatedUser,
    driverId: string,
    input: DriverVerificationDto,
  ): Promise<DriverProfile> {
    const profile = await this.dataSource
      .getRepository(DriverProfile)
      .findOneBy({ userId: driverId });
    if (!profile) {
      throw new NotFoundException('Driver profile not found');
    }
    if (
      input.status === DriverVerificationStatus.APPROVED &&
      new Date(profile.licenseExpiry) <= new Date()
    ) {
      throw new BadRequestException('Cannot approve an expired driver license');
    }
    profile.verificationStatus = input.status;
    profile.identityVerified =
      input.status === DriverVerificationStatus.APPROVED;
    if (input.status !== DriverVerificationStatus.APPROVED) {
      profile.isOnline = false;
      profile.isAvailable = false;
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(DriverProfile).save(profile);
      await manager.getRepository(AuditLog).insert({
        actorId: actor.id,
        eventType: `admin.driver_${input.status.toLowerCase()}`,
        targetId: driverId,
        metadata: {},
      });
    });
    return profile;
  }

  async verifyVehicle(
    actor: AuthenticatedUser,
    vehicleId: string,
    input: VehicleVerificationDto,
  ): Promise<Vehicle> {
    const vehicle = await this.dataSource.getRepository(Vehicle).findOneBy({
      id: vehicleId,
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    if (
      input.status === VehicleVerificationStatus.APPROVED &&
      new Date(vehicle.documentExpiresAt) <= new Date()
    ) {
      throw new BadRequestException('Cannot approve expired vehicle documents');
    }
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(Vehicle)
        .update({ id: vehicleId }, { verificationStatus: input.status });
      if (input.status !== VehicleVerificationStatus.APPROVED) {
        await manager
          .getRepository(DriverProfile)
          .update({ userId: vehicle.driverId }, { isAvailable: false });
      }
      await manager.getRepository(AuditLog).insert({
        actorId: actor.id,
        eventType: `admin.vehicle_${input.status.toLowerCase()}`,
        targetId: vehicle.driverId,
        metadata: { vehicleId },
      });
    });
    vehicle.verificationStatus = input.status;
    return vehicle;
  }

  async setVehicleActive(
    user: AuthenticatedUser,
    vehicleId: string,
    isActive: boolean,
  ): Promise<Vehicle> {
    this.assertDriver(user);
    const vehicle = await this.dataSource.getRepository(Vehicle).findOneBy({
      id: vehicleId,
      driverId: user.id,
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    vehicle.isActive = isActive;
    return this.dataSource.getRepository(Vehicle).save(vehicle);
  }

  private assertDriver(user: AuthenticatedUser): void {
    if (user.role !== UserRole.DRIVER || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('An active driver account is required');
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('driverError' in error)
    ) {
      return false;
    }
    const driverError: unknown = error.driverError;
    return (
      typeof driverError === 'object' &&
      driverError !== null &&
      'code' in driverError &&
      driverError.code === '23505'
    );
  }
}
