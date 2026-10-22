import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { DataSource, QueryFailedError } from 'typeorm';
import { AuditLog } from '../../database/audit-log.entity';
import { DriverProfile } from '../drivers/driver-profile.entity';
import { VehicleCategory, VehicleType } from '../drivers/vehicle.entity';
import { Coordinates, RoutingService } from '../maps/routing.service';
import { PricingService } from '../pricing/pricing.service';
import { FareEstimateDto } from '../pricing/dto/fare-estimate.dto';
import { AuthenticatedUser } from '../auth/auth.types';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { CancelRideDto } from './dto/cancel-ride.dto';
import { CreateRideDto } from './dto/create-ride.dto';
import { ListRidesDto } from './dto/list-rides.dto';
import { Ride, RidePaymentMethod, RideStatus } from './ride.entity';
import { RideOffer, RideOfferStatus } from './ride-offer.entity';
import { RideRealtimeGateway } from './ride-realtime.gateway';

interface MatchingCandidate {
  user_id: string;
  pickup_distance_m: number;
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.every((row: unknown) => typeof row === 'object' && row !== null)
  );
}

export interface CreatedRide {
  ride: unknown;
  pickupPin: string;
  fare: ReturnType<PricingService['estimate']>;
  routeSource: string;
  offersCreated: number;
  noDriversAvailable: boolean;
}

@Injectable()
export class RidesService {
  private readonly offerTtlSeconds: number;
  private readonly matchRadiusMeters: number;
  private readonly matchLimit: number;
  private readonly maxLocationAgeSeconds: number;
  private readonly pinEncryptionKey: Buffer;

  constructor(
    private readonly dataSource: DataSource,
    private readonly routing: RoutingService,
    private readonly pricing: PricingService,
    private readonly realtime: RideRealtimeGateway,
    config: ConfigService,
  ) {
    this.offerTtlSeconds = config.get<number>('RIDE_OFFER_TTL_SECONDS', 45);
    this.matchRadiusMeters = config.get<number>(
      'DRIVER_MATCH_RADIUS_METERS',
      4000,
    );
    this.matchLimit = config.get<number>('DRIVER_MATCH_LIMIT', 5);
    this.maxLocationAgeSeconds = config.get<number>(
      'DRIVER_LOCATION_MAX_AGE_SECONDS',
      120,
    );
    this.pinEncryptionKey = scryptSync(
      config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      'fairride-trip-pin-v1',
      32,
    );
  }

  async create(
    user: AuthenticatedUser,
    input: CreateRideDto,
    idempotencyKey: string | undefined,
  ): Promise<CreatedRide> {
    this.assertRole(user, UserRole.PASSENGER);
    const normalizedKey = this.validateIdempotencyKey(idempotencyKey);
    const userEntity = await this.dataSource.getRepository(User).findOne({
      where: { id: user.id, status: UserStatus.ACTIVE },
    });
    if (!userEntity) {
      throw new UnauthorizedException('Account is unavailable');
    }

    if (!userEntity.phoneVerifiedAt) {
      throw new ForbiddenException(
        'Verify your phone number before requesting a ride',
      );
    }

    const fingerprint = this.fingerprint(input);
    const existing = await this.findIdempotentRide(user.id, normalizedKey);
    if (existing) {
      return this.replayExisting(existing, fingerprint);
    }

    const activeRide = await this.dataSource
      .getRepository(Ride)
      .createQueryBuilder('ride')
      .where('ride.passengerId = :passengerId', { passengerId: user.id })
      .andWhere('ride.status IN (:...statuses)', {
        statuses: [
          RideStatus.SEARCHING,
          RideStatus.ACCEPTED,
          RideStatus.DRIVER_ARRIVING,
          RideStatus.IN_PROGRESS,
        ],
      })
      .getOne();
    if (activeRide) {
      throw new ConflictException(
        'Complete or cancel your active ride before requesting another',
      );
    }

    const pickup: Coordinates = {
      latitude: input.pickupLatitude,
      longitude: input.pickupLongitude,
    };
    const destination: Coordinates = {
      latitude: input.destinationLatitude,
      longitude: input.destinationLongitude,
    };
    const route = await this.routing.estimate(pickup, destination);
    if (route.distanceMeters > 100_000) {
      throw new BadRequestException('Ride distance exceeds the 100 km limit');
    }
    const fare = await this.pricing.estimateCurrent(
      route,
      input.vehicleCategory,
    );
    const pickupPin = randomInt(100000, 1000000).toString();
    const now = new Date();
    const ride = this.dataSource.getRepository(Ride).create({
      id: randomUUID(),
      passengerId: user.id,
      driverId: null,
      status: RideStatus.SEARCHING,
      vehicleCategory: input.vehicleCategory,
      vehicleType: input.vehicleType ?? VehicleType.CAR,
      pickupLatitude: input.pickupLatitude,
      pickupLongitude: input.pickupLongitude,
      pickupLabel: input.pickupLabel.trim(),
      destinationLatitude: input.destinationLatitude,
      destinationLongitude: input.destinationLongitude,
      destinationLabel: input.destinationLabel.trim(),
      estimatedDistanceM: route.distanceMeters,
      estimatedDurationS: route.durationSeconds,
      estimatedFarePaisa: fare.passengerTotalPaisa,
      fareBreakdown: fare,
      routeSource: route.source,
      finalFarePaisa: null,
      currency: 'PKR',
      paymentMethod: RidePaymentMethod.CASH,
      pickupPinHash: this.hash(pickupPin),
      pickupPinEncrypted: this.encryptPin(pickupPin),
      idempotencyKey: normalizedKey,
      requestFingerprint: fingerprint,
      expiresAt: new Date(now.getTime() + 180_000),
      acceptedAt: null,
      arrivedAt: null,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancellationReason: null,
    });
    const candidates = await this.findNearbyDrivers(
      pickup,
      input.vehicleCategory,
      input.vehicleType ?? VehicleType.CAR,
    );
    const offerExpiresAt = new Date(
      now.getTime() + this.offerTtlSeconds * 1000,
    );
    if (candidates.length === 0) {
      ride.status = RideStatus.EXPIRED;
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(Ride).insert(ride);
        if (candidates.length > 0) {
          await manager.getRepository(RideOffer).insert(
            candidates.map((candidate) => ({
              rideId: ride.id,
              driverId: candidate.user_id,
              pickupDistanceM: Number(candidate.pickup_distance_m),
              status: RideOfferStatus.PENDING,
              expiresAt: offerExpiresAt,
            })),
          );
        }
        await manager.getRepository(AuditLog).insert({
          actorId: user.id,
          eventType: 'ride.requested',
          targetId: ride.id,
          metadata: {
            vehicleCategory: ride.vehicleCategory,
            routeSource: route.source,
            offersCreated: candidates.length,
          },
        });
      });
      for (const candidate of candidates) {
        this.realtime.emitOfferCreated(candidate.user_id, ride.id);
      }
      return {
        ride: this.rideView(
          await this.dataSource
            .getRepository(Ride)
            .createQueryBuilder('ride')
            .addSelect('ride.pickupPinEncrypted')
            .where('ride.id = :id', { id: ride.id })
            .getOneOrFail(),
          true,
        ),
        pickupPin,
        fare,
        routeSource: route.source,
        offersCreated: candidates.length,
        noDriversAvailable: candidates.length === 0,
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const duplicate = await this.findIdempotentRide(user.id, normalizedKey);
        if (duplicate) {
          return this.replayExisting(duplicate, fingerprint);
        }
        const active = await this.dataSource
          .getRepository(Ride)
          .createQueryBuilder('ride')
          .where('ride.passengerId = :passengerId', { passengerId: user.id })
          .andWhere('ride.status IN (:...statuses)', {
            statuses: [
              RideStatus.SEARCHING,
              RideStatus.ACCEPTED,
              RideStatus.DRIVER_ARRIVING,
              RideStatus.IN_PROGRESS,
            ],
          })
          .getOne();
        if (active) {
          throw new ConflictException(
            'Complete or cancel your active ride before requesting another',
          );
        }
        throw new ConflictException('A ride request with this key exists');
      }
      throw error;
    }
  }

  async estimateFare(user: AuthenticatedUser, input: FareEstimateDto) {
    if (user.role !== UserRole.PASSENGER && user.role !== UserRole.DRIVER) {
      throw new ForbiddenException('Passenger or driver account required');
    }
    const route = await this.routing.estimate(
      {
        latitude: input.pickupLatitude,
        longitude: input.pickupLongitude,
      },
      {
        latitude: input.destinationLatitude,
        longitude: input.destinationLongitude,
      },
    );
    if (route.distanceMeters > 100_000) {
      throw new BadRequestException('Ride distance exceeds the 100 km limit');
    }
    return {
      ...(await this.pricing.estimateCurrent(route, input.vehicleCategory)),
      routeSource: route.source,
      estimateExpiresInSeconds: 300,
    };
  }

  async driverOffers(user: AuthenticatedUser): Promise<unknown[]> {
    this.assertRole(user, UserRole.DRIVER);
    await this.expireOldOffers(user.id);
    return this.dataSource
      .getRepository(RideOffer)
      .createQueryBuilder('offer')
      .innerJoin(Ride, 'ride', 'ride.id = offer.rideId')
      .select([
        'offer.id AS "offerId"',
        'offer.rideId AS "rideId"',
        'offer.pickupDistanceM AS "pickupDistanceMeters"',
        'offer.expiresAt AS "expiresAt"',
        'ride.pickupLabel AS "pickupLabel"',
        'ride.destinationLabel AS "destinationLabel"',
        'ride.pickupLatitude AS "pickupLatitude"',
        'ride.pickupLongitude AS "pickupLongitude"',
        'ride.estimatedFarePaisa AS "estimatedFarePaisa"',
        'ride.currency AS "currency"',
        'ride.vehicleCategory AS "vehicleCategory"',
        'ride.vehicleType AS "vehicleType"',
      ])
      .where('offer.driverId = :driverId', { driverId: user.id })
      .andWhere('offer.status = :offerStatus', {
        offerStatus: RideOfferStatus.PENDING,
      })
      .andWhere('offer.expiresAt > now()')
      .andWhere('ride.status = :rideStatus', {
        rideStatus: RideStatus.SEARCHING,
      })
      .orderBy('offer.pickupDistanceM', 'ASC')
      .addOrderBy('offer.createdAt', 'ASC')
      .take(20)
      .getRawMany();
  }

  async acceptOffer(user: AuthenticatedUser, rideId: string): Promise<Ride> {
    this.assertRole(user, UserRole.DRIVER);
    const acceptedRide = await this.dataSource.transaction(async (manager) => {
      const assigned: unknown = await manager.query(
        `UPDATE driver_profiles AS dp
         SET is_available = false, updated_at = now()
         FROM users AS u
         WHERE dp.user_id = $1 AND u.id = dp.user_id
           AND u.status = 'ACTIVE' AND u.phone_verified_at IS NOT NULL
           AND dp.verification_status = 'APPROVED'
           AND dp.identity_verified = true
           AND dp.is_online = true AND dp.is_available = true
           AND dp.last_location_at > now() - ($3 * interval '1 second')
           AND dp.license_expiry > CURRENT_DATE
           AND EXISTS (
             SELECT 1 FROM vehicles v
             JOIN rides r ON r.id = $2
             JOIN ride_offers ro ON ro.ride_id = r.id AND ro.driver_id = dp.user_id
             WHERE v.driver_id = dp.user_id AND v.category = r.vehicle_category
               AND v.vehicle_type = r.vehicle_type
               AND v.is_active = true AND v.verification_status = 'APPROVED'
               AND v.document_expires_at > CURRENT_DATE
               AND ro.status = 'PENDING' AND ro.expires_at > now()
               AND r.status = 'SEARCHING' AND r.expires_at > now()
           )
         RETURNING dp.user_id`,
        [user.id, rideId, this.maxLocationAgeSeconds],
      );
      if (!isRecordArray(assigned)) {
        throw new InternalServerErrorException(
          'Database returned an invalid driver assignment result',
        );
      }
      if (assigned.length !== 1) {
        throw new ConflictException(
          'No eligible active offer is available for this driver',
        );
      }

      const updated: unknown = await manager.query(
        `UPDATE rides
         SET driver_id = $2, status = 'ACCEPTED', accepted_at = now(),
             updated_at = now()
         WHERE id = $1 AND status = 'SEARCHING' AND expires_at > now()
           AND EXISTS (
             SELECT 1 FROM ride_offers
             WHERE ride_id = $1 AND driver_id = $2
               AND status = 'PENDING' AND expires_at > now()
           )
         RETURNING *`,
        [rideId, user.id],
      );
      if (!isRecordArray(updated)) {
        throw new InternalServerErrorException(
          'Database returned an invalid ride assignment result',
        );
      }
      if (updated.length !== 1) {
        throw new ConflictException('Ride is no longer available');
      }

      await manager.query(
        `UPDATE ride_offers
         SET status = CASE WHEN driver_id = $2 THEN 'ACCEPTED' ELSE 'EXPIRED' END
         WHERE ride_id = $1 AND status = 'PENDING'`,
        [rideId, user.id],
      );
      await manager.getRepository(AuditLog).insert({
        actorId: user.id,
        eventType: 'ride.accepted',
        targetId: rideId,
        metadata: {},
      });
      return manager.getRepository(Ride).findOneByOrFail({ id: rideId });
    });
    this.realtime.emitRideStatus(rideId, acceptedRide.status);
    return acceptedRide;
  }

  async rejectOffer(
    user: AuthenticatedUser,
    rideId: string,
  ): Promise<{ rejected: true }> {
    this.assertRole(user, UserRole.DRIVER);
    const result = await this.dataSource.getRepository(RideOffer).update(
      {
        rideId,
        driverId: user.id,
        status: RideOfferStatus.PENDING,
      },
      { status: RideOfferStatus.REJECTED },
    );
    if (result.affected !== 1) {
      throw new NotFoundException('Active ride offer not found');
    }
    return { rejected: true };
  }

  async getRide(user: AuthenticatedUser, rideId: string): Promise<unknown> {
    const ride = await this.dataSource
      .getRepository(Ride)
      .createQueryBuilder('ride')
      .addSelect('ride.pickupPinEncrypted')
      .where('ride.id = :rideId', { rideId })
      .getOne();
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }
    const passengerView = user.id === ride.passengerId;
    if (!passengerView && user.id !== ride.driverId) {
      throw new ForbiddenException('You are not a participant in this ride');
    }
    return this.rideView(ride, passengerView);
  }

  async history(
    user: AuthenticatedUser,
    query: ListRidesDto,
  ): Promise<{ items: Ride[]; page: number; limit: number; total: number }> {
    if (user.role !== UserRole.PASSENGER && user.role !== UserRole.DRIVER) {
      throw new ForbiddenException('Passenger or driver account required');
    }
    const repository = this.dataSource.getRepository(Ride);
    const queryBuilder = repository.createQueryBuilder('ride');
    if (user.role === UserRole.PASSENGER) {
      queryBuilder.where('ride.passengerId = :userId', { userId: user.id });
    } else {
      queryBuilder.where('ride.driverId = :userId', { userId: user.id });
    }
    const [items, total] = await queryBuilder
      .orderBy('ride.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return { items, page: query.page, limit: query.limit, total };
  }

  async markArrived(user: AuthenticatedUser, rideId: string): Promise<Ride> {
    this.assertRole(user, UserRole.DRIVER);
    const result = await this.dataSource
      .getRepository(Ride)
      .createQueryBuilder()
      .update(Ride)
      .set({ status: RideStatus.DRIVER_ARRIVING, arrivedAt: () => 'now()' })
      .where('id = :rideId AND driver_id = :driverId', {
        rideId,
        driverId: user.id,
      })
      .andWhere('status = :status', { status: RideStatus.ACCEPTED })
      .execute();
    if (result.affected !== 1) {
      const current = await this.getOwnedRide(user, rideId);
      if (current.status === RideStatus.DRIVER_ARRIVING) {
        return current;
      }
      throw new ConflictException('Ride cannot transition to driver arriving');
    }
    await this.audit(user.id, 'ride.driver_arrived', rideId);
    const ride = await this.getOwnedRide(user, rideId);
    this.realtime.emitRideStatus(rideId, ride.status);
    return ride;
  }

  async start(
    user: AuthenticatedUser,
    rideId: string,
    pin: string,
  ): Promise<Ride> {
    this.assertRole(user, UserRole.DRIVER);
    const ride = await this.dataSource
      .getRepository(Ride)
      .createQueryBuilder('ride')
      .addSelect('ride.pickupPinHash')
      .where('ride.id = :rideId AND ride.driverId = :driverId', {
        rideId,
        driverId: user.id,
      })
      .getOne();
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }
    if (ride.status === RideStatus.IN_PROGRESS) {
      return this.getOwnedRide(user, rideId);
    }
    if (ride.status !== RideStatus.DRIVER_ARRIVING) {
      throw new ConflictException('Ride is not ready to start');
    }
    if (!this.matchesHash(pin, ride.pickupPinHash)) {
      throw new ForbiddenException('Pickup PIN is invalid');
    }
    const result = await this.dataSource
      .getRepository(Ride)
      .update(
        { id: rideId, driverId: user.id, status: RideStatus.DRIVER_ARRIVING },
        { status: RideStatus.IN_PROGRESS, startedAt: new Date() },
      );
    if (result.affected !== 1) {
      const current = await this.getOwnedRide(user, rideId);
      if (current.status === RideStatus.IN_PROGRESS) {
        return current;
      }
      throw new ConflictException('Ride could not be started');
    }
    await this.audit(user.id, 'ride.started', rideId);
    const startedRide = await this.getOwnedRide(user, rideId);
    this.realtime.emitRideStatus(rideId, startedRide.status);
    return startedRide;
  }

  async complete(user: AuthenticatedUser, rideId: string): Promise<Ride> {
    this.assertRole(user, UserRole.DRIVER);
    const existingAssignment = await this.dataSource
      .getRepository(Ride)
      .findOneBy({ id: rideId, driverId: user.id });
    if (
      existingAssignment &&
      [
        RideStatus.ACCEPTED,
        RideStatus.DRIVER_ARRIVING,
        RideStatus.IN_PROGRESS,
        RideStatus.COMPLETED,
      ].includes(existingAssignment.status)
    ) {
      return existingAssignment;
    }
    const completedRide = await this.dataSource.transaction(async (manager) => {
      const ride = await manager.getRepository(Ride).findOneBy({ id: rideId });
      if (!ride || ride.driverId !== user.id) {
        throw new NotFoundException('Ride not found');
      }
      if (ride.status === RideStatus.COMPLETED) {
        return ride;
      }
      if (ride.status !== RideStatus.IN_PROGRESS) {
        throw new ConflictException(
          'Only an in-progress ride can be completed',
        );
      }
      const completed = await manager.getRepository(Ride).update(
        {
          id: rideId,
          driverId: user.id,
          status: RideStatus.IN_PROGRESS,
        },
        {
          status: RideStatus.COMPLETED,
          completedAt: new Date(),
          finalFarePaisa: ride.estimatedFarePaisa,
        },
      );
      if (completed.affected !== 1) {
        throw new ConflictException('Ride completion did not succeed');
      }
      await manager
        .getRepository(DriverProfile)
        .increment({ userId: user.id }, 'completedRidesCount', 1);
      await manager.getRepository(DriverProfile).query(
        `UPDATE driver_profiles SET is_available = is_online
         WHERE user_id = $1 AND verification_status = 'APPROVED'`,
        [user.id],
      );
      await manager.getRepository(AuditLog).insert({
        actorId: user.id,
        eventType: 'ride.completed',
        targetId: rideId,
        metadata: { finalFarePaisa: ride.estimatedFarePaisa },
      });
      return manager.getRepository(Ride).findOneByOrFail({ id: rideId });
    });
    this.realtime.emitRideStatus(rideId, completedRide.status);
    return completedRide;
  }

  async cancel(
    user: AuthenticatedUser,
    rideId: string,
    input: CancelRideDto,
  ): Promise<Ride> {
    if (user.role !== UserRole.PASSENGER && user.role !== UserRole.DRIVER) {
      throw new ForbiddenException('Passenger or driver account required');
    }
    const cancelledRide = await this.dataSource.transaction(async (manager) => {
      const ride = await manager.getRepository(Ride).findOneBy({ id: rideId });
      if (
        !ride ||
        (ride.passengerId !== user.id && ride.driverId !== user.id)
      ) {
        throw new NotFoundException('Ride not found');
      }
      if (ride.status === RideStatus.CANCELLED) {
        return ride;
      }
      if (
        ride.status !== RideStatus.SEARCHING &&
        ride.status !== RideStatus.ACCEPTED &&
        ride.status !== RideStatus.DRIVER_ARRIVING
      ) {
        throw new ConflictException('Ride can no longer be cancelled');
      }
      const update = await manager.getRepository(Ride).update(
        {
          id: rideId,
          status: ride.status,
        },
        {
          status: RideStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: input.reason,
        },
      );
      if (update.affected !== 1) {
        throw new ConflictException('Ride status changed; refresh and retry');
      }
      if (ride.driverId) {
        await manager.getRepository(DriverProfile).query(
          `UPDATE driver_profiles SET is_available = is_online
           WHERE user_id = $1 AND verification_status = 'APPROVED'`,
          [ride.driverId],
        );
      }
      await manager
        .getRepository(RideOffer)
        .update(
          { rideId, status: RideOfferStatus.PENDING },
          { status: RideOfferStatus.EXPIRED },
        );
      await manager.getRepository(AuditLog).insert({
        actorId: user.id,
        eventType: 'ride.cancelled',
        targetId: rideId,
        metadata: { reason: input.reason },
      });
      return manager.getRepository(Ride).findOneByOrFail({ id: rideId });
    });
    this.realtime.emitRideStatus(rideId, cancelledRide.status);
    return cancelledRide;
  }

  private async findNearbyDrivers(
    pickup: Coordinates,
    category: VehicleCategory,
    vehicleType: VehicleType,
  ): Promise<MatchingCandidate[]> {
    const rows: unknown = await this.dataSource.query(
      `SELECT dp.user_id,
              MIN(ST_Distance(
                ST_SetSRID(ST_MakePoint(dp.longitude, dp.latitude), 4326)::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
              ))::integer AS pickup_distance_m
       FROM driver_profiles dp
       JOIN users u ON u.id = dp.user_id AND u.status = 'ACTIVE'
         AND u.phone_verified_at IS NOT NULL
       JOIN vehicles v ON v.driver_id = dp.user_id
         AND v.category = $3 AND v.vehicle_type = $4 AND v.is_active = true
         AND v.verification_status = 'APPROVED'
         AND v.document_expires_at > CURRENT_DATE
       WHERE dp.verification_status = 'APPROVED'
         AND dp.identity_verified = true
         AND dp.is_online = true AND dp.is_available = true
         AND dp.license_expiry > CURRENT_DATE
         AND dp.latitude IS NOT NULL AND dp.longitude IS NOT NULL
         AND dp.last_location_at > now() - ($6 * interval '1 second')
         AND ST_DWithin(
           ST_SetSRID(ST_MakePoint(dp.longitude, dp.latitude), 4326)::geography,
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           $5
         )
       GROUP BY dp.user_id
       ORDER BY MIN(ST_Distance(
         ST_SetSRID(ST_MakePoint(dp.longitude, dp.latitude), 4326)::geography,
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
       )) ASC
       LIMIT $7`,
      [
        pickup.longitude,
        pickup.latitude,
        category,
        vehicleType,
        this.matchRadiusMeters,
        this.maxLocationAgeSeconds,
        this.matchLimit,
      ],
    );
    if (!isRecordArray(rows)) {
      throw new InternalServerErrorException(
        'Database returned an invalid driver matching result',
      );
    }
    return rows.map((row) => {
      const distance = Number(row.pickup_distance_m);
      if (typeof row.user_id !== 'string' || !Number.isFinite(distance)) {
        throw new InternalServerErrorException(
          'Database returned an invalid driver matching candidate',
        );
      }
      return { user_id: row.user_id, pickup_distance_m: distance };
    });
  }

  private async expireOldOffers(driverId: string): Promise<void> {
    await this.dataSource
      .getRepository(RideOffer)
      .createQueryBuilder()
      .update(RideOffer)
      .set({ status: RideOfferStatus.EXPIRED })
      .where('driver_id = :driverId', { driverId })
      .andWhere('status = :status', { status: RideOfferStatus.PENDING })
      .andWhere('expires_at <= now()')
      .execute();
    await this.dataSource.query(
      `UPDATE rides r SET status = 'EXPIRED', updated_at = now()
       WHERE r.status = 'SEARCHING'
         AND (r.expires_at <= now() OR NOT EXISTS (
           SELECT 1 FROM ride_offers ro
           WHERE ro.ride_id = r.id AND ro.status = 'PENDING'
             AND ro.expires_at > now()
         ))
      `,
    );
  }

  private async findIdempotentRide(
    passengerId: string,
    idempotencyKey: string,
  ): Promise<Ride | null> {
    return this.dataSource
      .getRepository(Ride)
      .createQueryBuilder('ride')
      .addSelect('ride.requestFingerprint')
      .addSelect('ride.pickupPinEncrypted')
      .where('ride.passengerId = :passengerId', { passengerId })
      .andWhere('ride.idempotencyKey = :idempotencyKey', { idempotencyKey })
      .getOne();
  }

  private replayExisting(ride: Ride, fingerprint: string): CreatedRide {
    if (ride.requestFingerprint !== fingerprint) {
      throw new ConflictException(
        'Idempotency-Key has already been used for a different ride request',
      );
    }
    return {
      ride: this.rideView(ride, true),
      pickupPin: this.decryptPin(ride.pickupPinEncrypted),
      fare: ride.fareBreakdown,
      routeSource: ride.routeSource,
      offersCreated: 0,
      noDriversAvailable: ride.status === RideStatus.EXPIRED,
    };
  }

  private validateIdempotencyKey(value: string | undefined): string {
    if (!value || !/^[A-Za-z0-9._:-]{8,128}$/.test(value)) {
      throw new BadRequestException(
        'Idempotency-Key header is required (8-128 safe characters)',
      );
    }
    return value;
  }

  private fingerprint(input: CreateRideDto): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          pickupLatitude: input.pickupLatitude,
          pickupLongitude: input.pickupLongitude,
          pickupLabel: input.pickupLabel.trim(),
          destinationLatitude: input.destinationLatitude,
          destinationLongitude: input.destinationLongitude,
          destinationLabel: input.destinationLabel.trim(),
          vehicleCategory: input.vehicleCategory,
          vehicleType: input.vehicleType ?? VehicleType.CAR,
        }),
      )
      .digest('hex');
  }

  private encryptPin(pin: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.pinEncryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(pin, 'utf8'),
      cipher.final(),
    ]);
    return [
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  private decryptPin(value: string): string {
    const [ivText, tagText, encryptedText, ...extra] = value.split('.');
    if (!ivText || !tagText || !encryptedText || extra.length > 0) {
      throw new ServiceUnavailableException(
        'Stored pickup verification data is unavailable',
      );
    }
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.pinEncryptionKey,
        Buffer.from(ivText, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedText, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException(
        'Stored pickup verification data is unavailable',
      );
    }
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private matchesHash(value: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hash(value), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private rideView(ride: Ride, passengerView: boolean) {
    return {
      id: ride.id,
      status: ride.status,
      vehicleCategory: ride.vehicleCategory,
      vehicleType: ride.vehicleType,
      pickup: {
        latitude: ride.pickupLatitude,
        longitude: ride.pickupLongitude,
        label: ride.pickupLabel,
      },
      destination: {
        latitude: ride.destinationLatitude,
        longitude: ride.destinationLongitude,
        label: ride.destinationLabel,
      },
      estimatedDistanceMeters: ride.estimatedDistanceM,
      estimatedDurationSeconds: ride.estimatedDurationS,
      estimatedFarePaisa: ride.estimatedFarePaisa,
      finalFarePaisa: ride.finalFarePaisa,
      currency: ride.currency,
      paymentMethod: ride.paymentMethod,
      ...(passengerView &&
      [
        RideStatus.SEARCHING,
        RideStatus.ACCEPTED,
        RideStatus.DRIVER_ARRIVING,
      ].includes(ride.status)
        ? { pickupPin: this.decryptPin(ride.pickupPinEncrypted) }
        : {}),
      driverId: passengerView ? ride.driverId : undefined,
      passengerId: passengerView ? undefined : ride.passengerId,
      acceptedAt: ride.acceptedAt,
      arrivedAt: ride.arrivedAt,
      startedAt: ride.startedAt,
      completedAt: ride.completedAt,
      cancelledAt: ride.cancelledAt,
      cancellationReason: ride.cancellationReason,
      createdAt: ride.createdAt,
    };
  }

  private async getOwnedRide(
    user: AuthenticatedUser,
    rideId: string,
  ): Promise<Ride> {
    const ride = await this.dataSource
      .getRepository(Ride)
      .findOneBy({ id: rideId });
    if (!ride || (ride.driverId !== user.id && ride.passengerId !== user.id)) {
      throw new NotFoundException('Ride not found');
    }
    return ride;
  }

  private async audit(
    actorId: string,
    eventType: string,
    rideId: string,
  ): Promise<void> {
    await this.dataSource.getRepository(AuditLog).insert({
      actorId,
      eventType,
      targetId: rideId,
      metadata: {},
    });
  }

  private assertRole(user: AuthenticatedUser, role: UserRole): void {
    if (user.role !== role || user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('This account cannot perform this action');
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
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
