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
import { DriverProfile } from '../drivers/driver-profile.entity';
import { DriverService } from '../drivers/driver.service';
import {
  DriverVerificationDto,
  VehicleVerificationDto,
} from '../drivers/dto/verification.dto';
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
  const efficiency = (key: string): number => {
    const result = row[key];
    const parsed = typeof result === 'number' ? result : Number(result);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 200) {
      throw new Error(`Database returned invalid ${key}`);
    }
    return parsed;
  };
  return {
    fuelPricePaisaPerLiter: value('fuelPricePaisaPerLiter'),
    economyFuelEfficiencyKmPerLiter: efficiency(
      'economyFuelEfficiencyKmPerLiter',
    ),
    baseFarePaisa: value('baseFarePaisa'),
    perKmFarePaisa: value('perKmFarePaisa'),
    perMinuteFarePaisa: value('perMinuteFarePaisa'),
    minimumFarePaisa: value('minimumFarePaisa'),
    comfortFuelEfficiencyKmPerLiter: efficiency(
      'comfortFuelEfficiencyKmPerLiter',
    ),
    comfortBaseFarePaisa: value('comfortBaseFarePaisa'),
    comfortPerKmFarePaisa: value('comfortPerKmFarePaisa'),
    comfortPerMinuteFarePaisa: value('comfortPerMinuteFarePaisa'),
    comfortMinimumFarePaisa: value('comfortMinimumFarePaisa'),
    xlFuelEfficiencyKmPerLiter: efficiency('xlFuelEfficiencyKmPerLiter'),
    xlBaseFarePaisa: value('xlBaseFarePaisa'),
    xlPerKmFarePaisa: value('xlPerKmFarePaisa'),
    xlPerMinuteFarePaisa: value('xlPerMinuteFarePaisa'),
    xlMinimumFarePaisa: value('xlMinimumFarePaisa'),
    bikeBaseFarePaisa: value('bikeBaseFarePaisa'),
    bikePerKmFarePaisa: value('bikePerKmFarePaisa'),
    bikePerMinuteFarePaisa: value('bikePerMinuteFarePaisa'),
    bikeMinimumFarePaisa: value('bikeMinimumFarePaisa'),
    rickshawBaseFarePaisa: value('rickshawBaseFarePaisa'),
    rickshawPerKmFarePaisa: value('rickshawPerKmFarePaisa'),
    rickshawPerMinuteFarePaisa: value('rickshawPerMinuteFarePaisa'),
    rickshawMinimumFarePaisa: value('rickshawMinimumFarePaisa'),
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
    const result: unknown = await this.dataSource.query(`
      SELECT
        (SELECT COUNT(*) FROM users)::bigint AS "totalUsers",
        (SELECT COUNT(*) FROM users WHERE role = 'PASSENGER')::bigint AS "totalPassengers",
        (SELECT COUNT(*) FROM users
          WHERE role = 'PASSENGER' AND created_at >= now() - interval '30 days')::bigint AS "newPassengers30d",
        (SELECT COUNT(*) FROM users
          WHERE role = 'PASSENGER' AND status = 'ACTIVE')::bigint AS "activePassengers",
        (SELECT COUNT(*) FROM users
          WHERE role = 'PASSENGER' AND phone_verified_at IS NOT NULL)::bigint AS "verifiedPassengers",
        (SELECT COUNT(*) FROM users WHERE role = 'DRIVER')::bigint AS "totalDrivers",
        (SELECT COUNT(*) FROM users
          WHERE role = 'DRIVER' AND created_at >= now() - interval '30 days')::bigint AS "newDrivers30d",
        (SELECT COUNT(*) FROM users
          WHERE role = 'DRIVER' AND status = 'ACTIVE')::bigint AS "activeDrivers",
        (SELECT COUNT(*) FROM driver_profiles profile
          INNER JOIN users account ON account.id = profile.user_id
          WHERE account.status = 'ACTIVE' AND profile.is_online = true)::bigint AS "onlineDrivers",
        (SELECT COUNT(*) FROM rides
          WHERE status IN ('SEARCHING', 'ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS'))::bigint AS "activeRides",
        (SELECT COUNT(*) FROM rides WHERE status = 'COMPLETED')::bigint AS "completedRides",
        (SELECT COUNT(*) FROM rides
          WHERE created_at >= now() - interval '30 days')::bigint AS "rideRequests30d",
        (SELECT COUNT(*) FROM rides
          WHERE status = 'COMPLETED' AND completed_at >= now() - interval '30 days')::bigint AS "completedRides30d",
        (SELECT COUNT(*) FROM rides
          WHERE status = 'CANCELLED' AND created_at >= now() - interval '30 days')::bigint AS "cancelledRides30d",
        (SELECT COALESCE(SUM(final_fare_paisa), 0) FROM rides
          WHERE status = 'COMPLETED' AND completed_at >= now() - interval '30 days')::bigint AS "fareRevenuePaisa30d",
        (SELECT COALESCE(AVG(final_fare_paisa), 0)::bigint FROM rides
          WHERE status = 'COMPLETED' AND completed_at >= now() - interval '30 days')::bigint AS "averageFarePaisa30d",
        (SELECT COUNT(*) FROM driver_profiles
          WHERE verification_status = 'PENDING')::bigint AS "pendingDrivers",
        (SELECT COUNT(*) FROM vehicles
          WHERE verification_status = 'PENDING')::bigint AS "pendingVehicles"
    `);
    if (!isRecordArray(result) || result.length !== 1) {
      throw new Error('Database returned invalid admin analytics');
    }
    const row = result[0];
    const metric = (key: string): number => {
      const value = row[key];
      const parsed = typeof value === 'number' ? value : Number(value);
      if (!Number.isSafeInteger(parsed) || parsed < 0) {
        throw new Error(`Database returned invalid analytics metric ${key}`);
      }
      return parsed;
    };
    return {
      totalUsers: metric('totalUsers'),
      totalPassengers: metric('totalPassengers'),
      newPassengers30d: metric('newPassengers30d'),
      activePassengers: metric('activePassengers'),
      verifiedPassengers: metric('verifiedPassengers'),
      totalDrivers: metric('totalDrivers'),
      newDrivers30d: metric('newDrivers30d'),
      activeDrivers: metric('activeDrivers'),
      onlineDrivers: metric('onlineDrivers'),
      activeRides: metric('activeRides'),
      completedRides: metric('completedRides'),
      rideRequests30d: metric('rideRequests30d'),
      completedRides30d: metric('completedRides30d'),
      cancelledRides30d: metric('cancelledRides30d'),
      fareRevenuePaisa30d: metric('fareRevenuePaisa30d'),
      averageFarePaisa30d: metric('averageFarePaisa30d'),
      pendingDrivers: metric('pendingDrivers'),
      pendingVehicles: metric('pendingVehicles'),
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
        'profile.isOnline',
        'profile.isAvailable',
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

  async listUserRides(userId: string, query: AdminListDto) {
    const account = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: userId }, select: { id: true, role: true } });
    if (!account) throw new NotFoundException('Account not found');
    if (![UserRole.PASSENGER, UserRole.DRIVER].includes(account.role)) {
      throw new ConflictException(
        'Ride history is only available for passenger and driver accounts',
      );
    }

    const ownerColumn =
      account.role === UserRole.PASSENGER
        ? 'ride.passengerId'
        : 'ride.driverId';
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
      ])
      .where(`${ownerColumn} = :userId`, { userId });
    if (query.rideStatus) {
      builder.andWhere('ride.status = :rideStatus', {
        rideStatus: query.rideStatus,
      });
    }
    const [items, total, summary] = await Promise.all([
      builder
        .clone()
        .orderBy('ride.createdAt', 'DESC')
        .skip((query.page - 1) * query.pageSize)
        .take(query.pageSize)
        .getRawMany<Record<string, unknown>>(),
      builder.getCount(),
      this.dataSource
        .getRepository(Ride)
        .createQueryBuilder('ride')
        .select('COUNT(*)::bigint', 'totalRides')
        .addSelect(
          "COUNT(*) FILTER (WHERE ride.status = 'COMPLETED')::bigint",
          'completedRides',
        )
        .addSelect(
          "COUNT(*) FILTER (WHERE ride.status = 'CANCELLED')::bigint",
          'cancelledRides',
        )
        .where(`${ownerColumn} = :userId`, { userId })
        .getRawOne<Record<string, unknown>>(),
    ]);
    if (!summary)
      throw new Error('Database returned invalid account ride stats');
    const count = (key: string): number => {
      const value = summary[key];
      const parsed = typeof value === 'number' ? value : Number(value);
      if (!Number.isSafeInteger(parsed) || parsed < 0) {
        throw new Error(
          `Database returned invalid account ride statistic ${key}`,
        );
      }
      return parsed;
    };
    return {
      ...this.page(items, total, query),
      totalRides: count('totalRides'),
      completedRides: count('completedRides'),
      cancelledRides: count('cancelledRides'),
    };
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
      `SELECT fuel_price_paisa_per_liter AS "fuelPricePaisaPerLiter",
              economy_fuel_efficiency_km_per_liter AS "economyFuelEfficiencyKmPerLiter",
              base_fare_paisa AS "baseFarePaisa",
              per_km_fare_paisa AS "perKmFarePaisa",
              per_minute_fare_paisa AS "perMinuteFarePaisa",
              minimum_fare_paisa AS "minimumFarePaisa",
              comfort_fuel_efficiency_km_per_liter AS "comfortFuelEfficiencyKmPerLiter",
              comfort_base_fare_paisa AS "comfortBaseFarePaisa",
              comfort_per_km_fare_paisa AS "comfortPerKmFarePaisa",
              comfort_per_minute_fare_paisa AS "comfortPerMinuteFarePaisa",
              comfort_minimum_fare_paisa AS "comfortMinimumFarePaisa",
              xl_fuel_efficiency_km_per_liter AS "xlFuelEfficiencyKmPerLiter",
              xl_base_fare_paisa AS "xlBaseFarePaisa",
              xl_per_km_fare_paisa AS "xlPerKmFarePaisa",
              xl_per_minute_fare_paisa AS "xlPerMinuteFarePaisa",
              xl_minimum_fare_paisa AS "xlMinimumFarePaisa",
              bike_base_fare_paisa AS "bikeBaseFarePaisa",
              bike_per_km_fare_paisa AS "bikePerKmFarePaisa",
              bike_per_minute_fare_paisa AS "bikePerMinuteFarePaisa",
              bike_minimum_fare_paisa AS "bikeMinimumFarePaisa",
              rickshaw_base_fare_paisa AS "rickshawBaseFarePaisa",
              rickshaw_per_km_fare_paisa AS "rickshawPerKmFarePaisa",
              rickshaw_per_minute_fare_paisa AS "rickshawPerMinuteFarePaisa",
              rickshaw_minimum_fare_paisa AS "rickshawMinimumFarePaisa",
              updated_at AS "updatedAt"
       FROM pricing_settings WHERE id = true`,
    );
    if (!isRecordArray(result)) {
      throw new Error('Database returned invalid pricing settings');
    }
    if (result.length) return pricingSettingsView(result[0]);
    const defaults = this.defaultPricingSettings();
    return { ...defaults, updatedAt: null };
  }

  async updatePricingSettings(
    actor: AuthenticatedUser,
    input: PricingSettingsDto,
  ) {
    const rows: unknown = await this.dataSource.transaction(async (manager) => {
      const result: unknown = await manager.query(
        `INSERT INTO pricing_settings (
           id, fuel_price_paisa_per_liter,
           economy_fuel_efficiency_km_per_liter,
           base_fare_paisa, per_km_fare_paisa,
           per_minute_fare_paisa, minimum_fare_paisa,
           comfort_fuel_efficiency_km_per_liter,
           comfort_base_fare_paisa, comfort_per_km_fare_paisa,
           comfort_per_minute_fare_paisa, comfort_minimum_fare_paisa,
           xl_fuel_efficiency_km_per_liter,
           xl_base_fare_paisa, xl_per_km_fare_paisa,
           xl_per_minute_fare_paisa, xl_minimum_fare_paisa,
           bike_base_fare_paisa, bike_per_km_fare_paisa,
           bike_per_minute_fare_paisa, bike_minimum_fare_paisa,
           rickshaw_base_fare_paisa, rickshaw_per_km_fare_paisa,
           rickshaw_per_minute_fare_paisa, rickshaw_minimum_fare_paisa,
           updated_by, updated_at
         ) VALUES (true, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                   $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
                   $24, $25, now())
         ON CONFLICT (id) DO UPDATE SET
           fuel_price_paisa_per_liter = EXCLUDED.fuel_price_paisa_per_liter,
           economy_fuel_efficiency_km_per_liter = EXCLUDED.economy_fuel_efficiency_km_per_liter,
           base_fare_paisa = EXCLUDED.base_fare_paisa,
           per_km_fare_paisa = EXCLUDED.per_km_fare_paisa,
           per_minute_fare_paisa = EXCLUDED.per_minute_fare_paisa,
           minimum_fare_paisa = EXCLUDED.minimum_fare_paisa,
           comfort_fuel_efficiency_km_per_liter = EXCLUDED.comfort_fuel_efficiency_km_per_liter,
           comfort_base_fare_paisa = EXCLUDED.comfort_base_fare_paisa,
           comfort_per_km_fare_paisa = EXCLUDED.comfort_per_km_fare_paisa,
           comfort_per_minute_fare_paisa = EXCLUDED.comfort_per_minute_fare_paisa,
           comfort_minimum_fare_paisa = EXCLUDED.comfort_minimum_fare_paisa,
           xl_fuel_efficiency_km_per_liter = EXCLUDED.xl_fuel_efficiency_km_per_liter,
           xl_base_fare_paisa = EXCLUDED.xl_base_fare_paisa,
           xl_per_km_fare_paisa = EXCLUDED.xl_per_km_fare_paisa,
           xl_per_minute_fare_paisa = EXCLUDED.xl_per_minute_fare_paisa,
           xl_minimum_fare_paisa = EXCLUDED.xl_minimum_fare_paisa,
           bike_base_fare_paisa = EXCLUDED.bike_base_fare_paisa,
           bike_per_km_fare_paisa = EXCLUDED.bike_per_km_fare_paisa,
           bike_per_minute_fare_paisa = EXCLUDED.bike_per_minute_fare_paisa,
           bike_minimum_fare_paisa = EXCLUDED.bike_minimum_fare_paisa,
           rickshaw_base_fare_paisa = EXCLUDED.rickshaw_base_fare_paisa,
           rickshaw_per_km_fare_paisa = EXCLUDED.rickshaw_per_km_fare_paisa,
           rickshaw_per_minute_fare_paisa = EXCLUDED.rickshaw_per_minute_fare_paisa,
           rickshaw_minimum_fare_paisa = EXCLUDED.rickshaw_minimum_fare_paisa,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()
         RETURNING base_fare_paisa AS "baseFarePaisa",
                   fuel_price_paisa_per_liter AS "fuelPricePaisaPerLiter",
                   economy_fuel_efficiency_km_per_liter AS "economyFuelEfficiencyKmPerLiter",
                   per_km_fare_paisa AS "perKmFarePaisa",
                   per_minute_fare_paisa AS "perMinuteFarePaisa",
                   minimum_fare_paisa AS "minimumFarePaisa",
                   comfort_fuel_efficiency_km_per_liter AS "comfortFuelEfficiencyKmPerLiter",
                   comfort_base_fare_paisa AS "comfortBaseFarePaisa",
                   comfort_per_km_fare_paisa AS "comfortPerKmFarePaisa",
                   comfort_per_minute_fare_paisa AS "comfortPerMinuteFarePaisa",
                   comfort_minimum_fare_paisa AS "comfortMinimumFarePaisa",
                   xl_fuel_efficiency_km_per_liter AS "xlFuelEfficiencyKmPerLiter",
                   xl_base_fare_paisa AS "xlBaseFarePaisa",
                   xl_per_km_fare_paisa AS "xlPerKmFarePaisa",
                   xl_per_minute_fare_paisa AS "xlPerMinuteFarePaisa",
                   xl_minimum_fare_paisa AS "xlMinimumFarePaisa",
                   bike_base_fare_paisa AS "bikeBaseFarePaisa",
                   bike_per_km_fare_paisa AS "bikePerKmFarePaisa",
                   bike_per_minute_fare_paisa AS "bikePerMinuteFarePaisa",
                   bike_minimum_fare_paisa AS "bikeMinimumFarePaisa",
                   rickshaw_base_fare_paisa AS "rickshawBaseFarePaisa",
                   rickshaw_per_km_fare_paisa AS "rickshawPerKmFarePaisa",
                   rickshaw_per_minute_fare_paisa AS "rickshawPerMinuteFarePaisa",
                   rickshaw_minimum_fare_paisa AS "rickshawMinimumFarePaisa",
                   updated_at AS "updatedAt"`,
        [
          input.fuelPricePaisaPerLiter,
          input.economyFuelEfficiencyKmPerLiter,
          input.baseFarePaisa,
          input.perKmFarePaisa,
          input.perMinuteFarePaisa,
          input.minimumFarePaisa,
          input.comfortFuelEfficiencyKmPerLiter,
          input.comfortBaseFarePaisa,
          input.comfortPerKmFarePaisa,
          input.comfortPerMinuteFarePaisa,
          input.comfortMinimumFarePaisa,
          input.xlFuelEfficiencyKmPerLiter,
          input.xlBaseFarePaisa,
          input.xlPerKmFarePaisa,
          input.xlPerMinuteFarePaisa,
          input.xlMinimumFarePaisa,
          input.bikeBaseFarePaisa,
          input.bikePerKmFarePaisa,
          input.bikePerMinuteFarePaisa,
          input.bikeMinimumFarePaisa,
          input.rickshawBaseFarePaisa,
          input.rickshawPerKmFarePaisa,
          input.rickshawPerMinuteFarePaisa,
          input.rickshawMinimumFarePaisa,
          actor.id,
        ],
      );
      await manager.getRepository(AuditLog).insert({
        actorId: actor.id,
        eventType: 'admin.pricing_updated',
        targetId: null,
        metadata: { ...input },
      });
      return result;
    });
    if (!isRecordArray(rows) || rows.length !== 1) {
      throw new Error('Unable to save pricing settings');
    }
    return pricingSettingsView(rows[0]);
  }

  private defaultPricingSettings() {
    const baseFarePaisa = this.config.get<number>('FARE_BASE_PAISA', 15000);
    const perKmFarePaisa = this.config.get<number>('FARE_PER_KM_PAISA', 3500);
    const perMinuteFarePaisa = this.config.get<number>(
      'FARE_PER_MINUTE_PAISA',
      500,
    );
    const minimumFarePaisa = this.config.get<number>(
      'FARE_MINIMUM_PAISA',
      20000,
    );
    return {
      fuelPricePaisaPerLiter: this.config.get<number>(
        'FUEL_PRICE_PAISA_PER_LITER',
        0,
      ),
      economyFuelEfficiencyKmPerLiter: 12,
      baseFarePaisa,
      perKmFarePaisa,
      perMinuteFarePaisa,
      minimumFarePaisa,
      comfortFuelEfficiencyKmPerLiter: 10,
      comfortBaseFarePaisa: Math.ceil(baseFarePaisa * 1.25),
      comfortPerKmFarePaisa: Math.ceil(perKmFarePaisa * 1.25),
      comfortPerMinuteFarePaisa: Math.ceil(perMinuteFarePaisa * 1.25),
      comfortMinimumFarePaisa: Math.ceil(minimumFarePaisa * 1.25),
      xlFuelEfficiencyKmPerLiter: 8,
      xlBaseFarePaisa: Math.ceil(baseFarePaisa * 1.5),
      xlPerKmFarePaisa: Math.ceil(perKmFarePaisa * 1.5),
      xlPerMinuteFarePaisa: Math.ceil(perMinuteFarePaisa * 1.5),
      xlMinimumFarePaisa: Math.ceil(minimumFarePaisa * 1.5),
      bikeBaseFarePaisa: this.config.get<number>(
        'FARE_BIKE_BASE_PAISA',
        baseFarePaisa,
      ),
      bikePerKmFarePaisa: this.config.get<number>(
        'FARE_BIKE_PER_KM_PAISA',
        perKmFarePaisa,
      ),
      bikePerMinuteFarePaisa: this.config.get<number>(
        'FARE_BIKE_PER_MINUTE_PAISA',
        perMinuteFarePaisa,
      ),
      bikeMinimumFarePaisa: this.config.get<number>(
        'FARE_BIKE_MINIMUM_PAISA',
        minimumFarePaisa,
      ),
      rickshawBaseFarePaisa: this.config.get<number>(
        'FARE_RICKSHAW_BASE_PAISA',
        baseFarePaisa,
      ),
      rickshawPerKmFarePaisa: this.config.get<number>(
        'FARE_RICKSHAW_PER_KM_PAISA',
        perKmFarePaisa,
      ),
      rickshawPerMinuteFarePaisa: this.config.get<number>(
        'FARE_RICKSHAW_PER_MINUTE_PAISA',
        perMinuteFarePaisa,
      ),
      rickshawMinimumFarePaisa: this.config.get<number>(
        'FARE_RICKSHAW_MINIMUM_PAISA',
        minimumFarePaisa,
      ),
    };
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
