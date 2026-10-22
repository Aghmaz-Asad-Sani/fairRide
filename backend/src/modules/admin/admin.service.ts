import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, IsNull } from 'typeorm';
import { AuditLog } from '../../database/audit-log.entity';
import { AuthSession } from '../auth/auth-session.entity';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  DriverProfile,
  DriverVerificationStatus,
} from '../drivers/driver-profile.entity';
import { DriverService } from '../drivers/driver.service';
import {
  DriverVerificationDto,
  VehicleVerificationDto,
} from '../drivers/dto/verification.dto';
import { Vehicle, VehicleVerificationStatus } from '../drivers/vehicle.entity';
import { Ride, RideStatus } from '../rides/ride.entity';
import { RideOffer, RideOfferStatus } from '../rides/ride-offer.entity';
import { RideRealtimeGateway } from '../rides/ride-realtime.gateway';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { AdminListDto } from './dto/admin-list.dto';
import { PricingSettingsDto } from './dto/pricing-settings.dto';

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.every((row: unknown) => typeof row === 'object' && row !== null)
  );
}

function pricingSettingsView(row: Record<string, unknown>) {
  const value = (key: string): number => {
    const result = row[key];
    const parsed = typeof result === 'number' ? result : Number(result);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new Error(`Database returned invalid ${key}`);
    }
    return parsed;
  };
  return {
    baseFarePaisa: value('baseFarePaisa'),
    perKmFarePaisa: value('perKmFarePaisa'),
    perMinuteFarePaisa: value('perMinuteFarePaisa'),
    minimumFarePaisa: value('minimumFarePaisa'),
    updatedAt:
      row.updatedAt instanceof Date || typeof row.updatedAt === 'string'
        ? row.updatedAt
        : null,
  };
}

@Injectable()
export class AdminService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly drivers: DriverService,
    private readonly config: ConfigService,
    private readonly realtime: RideRealtimeGateway,
  ) {}

  async overview() {
    const users = this.dataSource.getRepository(User);
    const rides = this.dataSource.getRepository(Ride);
    const drivers = this.dataSource.getRepository(DriverProfile);
    const vehicles = this.dataSource.getRepository(Vehicle);
    const [
      totalUsers,
      activeRides,
      completedRides,
      pendingDrivers,
      pendingVehicles,
    ] = await Promise.all([
      users.count(),
      rides.count({
        where: [
          { status: RideStatus.SEARCHING },
          { status: RideStatus.ACCEPTED },
          { status: RideStatus.DRIVER_ARRIVING },
          { status: RideStatus.IN_PROGRESS },
        ],
      }),
      rides.count({ where: { status: RideStatus.COMPLETED } }),
      drivers.count({
        where: { verificationStatus: DriverVerificationStatus.PENDING },
      }),
      vehicles.count({
        where: { verificationStatus: VehicleVerificationStatus.PENDING },
      }),
    ]);
    return {
      totalUsers,
      activeRides,
      completedRides,
      pendingDrivers,
      pendingVehicles,
    };
  }

  async listUsers(query: AdminListDto) {
    const builder = this.dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.name',
        'user.phone',
        'user.email',
        'user.role',
        'user.status',
        'user.phoneVerifiedAt',
        'user.createdAt',
      ]);
    if (query.q?.trim()) {
      builder.andWhere(
        '(user.name ILIKE :q OR user.phone ILIKE :q OR user.email ILIKE :q)',
        { q: `%${query.q.trim()}%` },
      );
    }
    if (query.role) builder.andWhere('user.role = :role', { role: query.role });
    if (query.status) {
      builder.andWhere('user.status = :status', { status: query.status });
    }
    const [items, total] = await builder
      .orderBy('user.createdAt', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    return this.page(items, total, query);
  }

  async listDrivers(query: AdminListDto) {
    const builder = this.dataSource
      .getRepository(DriverProfile)
      .createQueryBuilder('profile')
      .innerJoin('profile.user', 'user')
      .leftJoinAndSelect('profile.vehicles', 'vehicle')
      .select([
        'profile.userId',
        'profile.verificationStatus',
        'profile.licenseNumber',
        'profile.licenseExpiry',
        'profile.identityVerified',
        'profile.createdAt',
        'user.name',
        'user.phone',
        'user.email',
        'user.status',
        'vehicle.id',
        'vehicle.vehicleType',
        'vehicle.category',
        'vehicle.make',
        'vehicle.model',
        'vehicle.modelYear',
        'vehicle.registrationNumber',
        'vehicle.chassisNumber',
        'vehicle.engineNumber',
        'vehicle.documentExpiresAt',
        'vehicle.verificationStatus',
        'vehicle.isActive',
      ]);
    if (query.verificationStatus) {
      builder.andWhere('profile.verificationStatus = :verificationStatus', {
        verificationStatus: query.verificationStatus,
      });
    }
    if (query.q?.trim()) {
      builder.andWhere(
        '(user.name ILIKE :q OR user.phone ILIKE :q OR profile.licenseNumber ILIKE :q)',
        { q: `%${query.q.trim()}%` },
      );
    }
    const [items, total] = await builder
      .orderBy('profile.createdAt', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    return this.page(items, total, query);
  }

  async listRides(query: AdminListDto) {
    const builder = this.dataSource
      .getRepository(Ride)
      .createQueryBuilder('ride')
      .leftJoin(User, 'passenger', 'passenger.id = ride.passengerId')
      .leftJoin(User, 'driver', 'driver.id = ride.driverId')
      .select([
        'ride.id AS "id"',
        'ride.status AS "status"',
        'ride.vehicleType AS "vehicleType"',
        'ride.vehicleCategory AS "vehicleCategory"',
        'ride.pickupLabel AS "pickupLabel"',
        'ride.destinationLabel AS "destinationLabel"',
        'ride.estimatedFarePaisa AS "estimatedFarePaisa"',
        'ride.finalFarePaisa AS "finalFarePaisa"',
        'ride.currency AS "currency"',
        'ride.createdAt AS "createdAt"',
        'passenger.name AS "passengerName"',
        'driver.name AS "driverName"',
        '(SELECT COUNT(*) FROM ride_offers sent WHERE sent.ride_id = ride.id)::int AS "offersSent"',
        `(SELECT COUNT(*) FROM ride_offers pending
          WHERE pending.ride_id = ride.id AND pending.status = 'PENDING'
            AND pending.expires_at > now())::int AS "pendingOffers"`,
      ]);
    if (query.rideStatus) {
      builder.andWhere('ride.status = :rideStatus', {
        rideStatus: query.rideStatus,
      });
    }
    if (query.q?.trim()) {
      builder.andWhere(
        '(ride.pickupLabel ILIKE :q OR ride.destinationLabel ILIKE :q OR passenger.name ILIKE :q OR driver.name ILIKE :q)',
        { q: `%${query.q.trim()}%` },
      );
    }
    const [items, total] = await Promise.all([
      builder
        .orderBy('ride.createdAt', 'DESC')
        .skip((query.page - 1) * query.pageSize)
        .take(query.pageSize)
        .getRawMany(),
      builder.clone().getCount(),
    ]);
    return this.page(items, total, query);
  }

  async setUserStatus(
    actor: AuthenticatedUser,
    userId: string,
    status: UserStatus,
  ) {
    if (actor.id === userId && status !== UserStatus.ACTIVE) {
      throw new ConflictException('You cannot suspend your own admin account');
    }

    return this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(User);
      const target = await users.findOneBy({ id: userId });
      if (!target) throw new NotFoundException('Account not found');
      if (target.role === UserRole.SUPER_ADMIN) {
        throw new ConflictException(
          'Super-admin accounts cannot be changed here',
        );
      }
      target.status = status;
      await users.save(target);
      if (status === UserStatus.SUSPENDED) {
        await manager
          .getRepository(AuthSession)
          .update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
      }
      await manager.getRepository(AuditLog).insert({
        actorId: actor.id,
        eventType: `admin.user_${status.toLowerCase()}`,
        targetId: userId,
        metadata: {},
      });
      return {
        id: target.id,
        name: target.name,
        phone: target.phone,
        role: target.role,
        status: target.status,
      };
    });
  }

  async cancelRide(actor: AuthenticatedUser, rideId: string) {
    const cancelled = await this.dataSource.transaction(async (manager) => {
      const ride = await manager
        .getRepository(Ride)
        .createQueryBuilder('ride')
        .setLock('pessimistic_write')
        .where('ride.id = :rideId', { rideId })
        .getOne();
      if (!ride) throw new NotFoundException('Ride not found');
      if (
        [
          RideStatus.COMPLETED,
          RideStatus.CANCELLED,
          RideStatus.EXPIRED,
        ].includes(ride.status)
      ) {
        throw new ConflictException('This ride is already finished');
      }
      await manager.getRepository(Ride).update(
        { id: rideId },
        {
          status: RideStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: 'ADMIN_CANCELLED',
        },
      );
      await manager
        .getRepository(RideOffer)
        .update(
          { rideId, status: RideOfferStatus.PENDING },
          { status: RideOfferStatus.EXPIRED },
        );
      if (ride.driverId) {
        await manager.query(
          `UPDATE driver_profiles SET is_available = is_online
           WHERE user_id = $1 AND verification_status = 'APPROVED'`,
          [ride.driverId],
        );
      }
      await manager.getRepository(AuditLog).insert({
        actorId: actor.id,
        eventType: 'admin.ride_cancelled',
        targetId: rideId,
        metadata: { previousStatus: ride.status },
      });
      return ride;
    });
    this.realtime.emitRideStatus(rideId, RideStatus.CANCELLED);
    return {
      id: cancelled.id,
      status: RideStatus.CANCELLED,
      cancellationReason: 'ADMIN_CANCELLED',
    };
  }

  async getPricingSettings() {
    const result: unknown = await this.dataSource.query(
      `SELECT base_fare_paisa AS "baseFarePaisa",
              per_km_fare_paisa AS "perKmFarePaisa",
              per_minute_fare_paisa AS "perMinuteFarePaisa",
              minimum_fare_paisa AS "minimumFarePaisa",
              updated_at AS "updatedAt"
       FROM pricing_settings WHERE id = true`,
    );
    if (!isRecordArray(result)) {
      throw new Error('Database returned invalid pricing settings');
    }
    if (result.length) return pricingSettingsView(result[0]);
    return {
      baseFarePaisa: this.config.get<number>('FARE_BASE_PAISA', 15000),
      perKmFarePaisa: this.config.get<number>('FARE_PER_KM_PAISA', 3500),
      perMinuteFarePaisa: this.config.get<number>('FARE_PER_MINUTE_PAISA', 500),
      minimumFarePaisa: this.config.get<number>('FARE_MINIMUM_PAISA', 20000),
      updatedAt: null,
    };
  }

  async updatePricingSettings(
    actor: AuthenticatedUser,
    input: PricingSettingsDto,
  ) {
    const rows: unknown = await this.dataSource.transaction(async (manager) => {
      const result: unknown = await manager.query(
        `INSERT INTO pricing_settings (
           id, base_fare_paisa, per_km_fare_paisa,
           per_minute_fare_paisa, minimum_fare_paisa, updated_by, updated_at
         ) VALUES (true, $1, $2, $3, $4, $5, now())
         ON CONFLICT (id) DO UPDATE SET
           base_fare_paisa = EXCLUDED.base_fare_paisa,
           per_km_fare_paisa = EXCLUDED.per_km_fare_paisa,
           per_minute_fare_paisa = EXCLUDED.per_minute_fare_paisa,
           minimum_fare_paisa = EXCLUDED.minimum_fare_paisa,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()
         RETURNING base_fare_paisa AS "baseFarePaisa",
                   per_km_fare_paisa AS "perKmFarePaisa",
                   per_minute_fare_paisa AS "perMinuteFarePaisa",
                   minimum_fare_paisa AS "minimumFarePaisa",
                   updated_at AS "updatedAt"`,
        [
          input.baseFarePaisa,
          input.perKmFarePaisa,
          input.perMinuteFarePaisa,
          input.minimumFarePaisa,
          actor.id,
        ],
      );
      await manager.getRepository(AuditLog).insert({
        actorId: actor.id,
        eventType: 'admin.pricing_updated',
        targetId: null,
        metadata: {
          baseFarePaisa: input.baseFarePaisa,
          perKmFarePaisa: input.perKmFarePaisa,
          perMinuteFarePaisa: input.perMinuteFarePaisa,
          minimumFarePaisa: input.minimumFarePaisa,
        },
      });
      return result;
    });
    if (!isRecordArray(rows) || rows.length !== 1) {
      throw new Error('Unable to save pricing settings');
    }
    return pricingSettingsView(rows[0]);
  }

  verifyDriver(
    actor: AuthenticatedUser,
    driverId: string,
    input: DriverVerificationDto,
  ) {
    return this.drivers.verifyDriver(actor, driverId, input);
  }

  verifyVehicle(
    actor: AuthenticatedUser,
    vehicleId: string,
    input: VehicleVerificationDto,
  ) {
    return this.drivers.verifyVehicle(actor, vehicleId, input);
  }

  private page<T>(items: T[], total: number, query: AdminListDto) {
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
}
