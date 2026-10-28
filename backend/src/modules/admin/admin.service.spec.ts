import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { DriverService } from '../drivers/driver.service';
import { RideRealtimeGateway } from '../rides/ride-realtime.gateway';
import { Ride } from '../rides/ride.entity';
import { AdminListDto } from './dto/admin-list.dto';
import { User, UserRole, UserStatus } from '../users/user.entity';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  const actor: AuthenticatedUser = {
    id: 'actor-id',
    role: UserRole.SUPER_ADMIN,
    status: UserStatus.ACTIVE,
    sessionId: 'session-id',
  };

  it('prevents an admin from suspending their own account', async () => {
    const transaction = jest.fn();
    const dataSource = {
      transaction,
    } as unknown as DataSource;
    const service = new AdminService(
      dataSource,
      {} as unknown as DriverService,
      {} as unknown as ConfigService,
      { emitRideStatus: jest.fn() } as unknown as RideRealtimeGateway,
    );

    await expect(
      service.setUserStatus(actor, actor.id, UserStatus.SUSPENDED),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('protects other super-admin accounts from status changes', async () => {
    const repository = {
      findOneBy: jest
        .fn()
        .mockResolvedValue({ id: 'other-admin', role: UserRole.SUPER_ADMIN }),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(repository),
    };
    const dataSource = {
      transaction: jest.fn(
        (callback: (transaction: typeof manager) => Promise<unknown>) =>
          callback(manager),
      ),
    } as unknown as DataSource;
    const service = new AdminService(
      dataSource,
      {} as unknown as DriverService,
      {} as unknown as ConfigService,
      { emitRideStatus: jest.fn() } as unknown as RideRealtimeGateway,
    );

    await expect(
      service.setUserStatus(actor, 'other-admin', UserStatus.SUSPENDED),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns role-specific registration, engagement, ride, and fare analytics', async () => {
    const metrics = {
      totalUsers: '12',
      totalPassengers: '7',
      newPassengers30d: '2',
      activePassengers: '6',
      verifiedPassengers: '5',
      totalDrivers: '4',
      newDrivers30d: '1',
      activeDrivers: '3',
      onlineDrivers: '2',
      activeRides: '1',
      completedRides: '20',
      rideRequests30d: '8',
      completedRides30d: '5',
      cancelledRides30d: '2',
      fareRevenuePaisa30d: '125000',
      averageFarePaisa30d: '25000',
      pendingDrivers: '1',
      pendingVehicles: '2',
    };
    const dataSource = {
      query: jest.fn().mockResolvedValue([metrics]),
    } as unknown as DataSource;
    const service = new AdminService(
      dataSource,
      {} as unknown as DriverService,
      {} as unknown as ConfigService,
      { emitRideStatus: jest.fn() } as unknown as RideRealtimeGateway,
    );

    await expect(service.overview()).resolves.toEqual({
      totalUsers: 12,
      totalPassengers: 7,
      newPassengers30d: 2,
      activePassengers: 6,
      verifiedPassengers: 5,
      totalDrivers: 4,
      newDrivers30d: 1,
      activeDrivers: 3,
      onlineDrivers: 2,
      activeRides: 1,
      completedRides: 20,
      rideRequests30d: 8,
      completedRides30d: 5,
      cancelledRides30d: 2,
      fareRevenuePaisa30d: 125000,
      averageFarePaisa30d: 25000,
      pendingDrivers: 1,
      pendingVehicles: 2,
    });
  });

  it('returns passenger ride history and summary counts', async () => {
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'passenger-id',
        role: UserRole.PASSENGER,
      }),
    };
    const pageBuilder = {
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ id: 'ride-id' }]),
    };
    const baseBuilder: Record<string, jest.Mock> = {};
    for (const method of ['leftJoin', 'select', 'where']) {
      baseBuilder[method] = jest.fn(() => baseBuilder);
    }
    baseBuilder.clone = jest.fn(() => pageBuilder);
    baseBuilder.getCount = jest.fn().mockResolvedValue(3);

    const summaryBuilder: Record<string, jest.Mock> = {};
    for (const method of ['select', 'addSelect', 'where']) {
      summaryBuilder[method] = jest.fn(() => summaryBuilder);
    }
    summaryBuilder.getRawOne = jest.fn().mockResolvedValue({
      totalRides: '3',
      completedRides: '2',
      cancelledRides: '1',
    });
    const rideRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(baseBuilder)
        .mockReturnValueOnce(summaryBuilder),
    };
    const dataSource = {
      getRepository: jest.fn((entity: typeof User | typeof Ride) =>
        entity === User ? userRepository : rideRepository,
      ),
    } as unknown as DataSource;
    const service = new AdminService(
      dataSource,
      {} as unknown as DriverService,
      {} as unknown as ConfigService,
      { emitRideStatus: jest.fn() } as unknown as RideRealtimeGateway,
    );

    await expect(
      service.listUserRides('passenger-id', {
        ...new AdminListDto(),
        page: 2,
        pageSize: 1,
      }),
    ).resolves.toMatchObject({
      items: [{ id: 'ride-id' }],
      page: 2,
      pageSize: 1,
      total: 3,
      totalPages: 3,
      totalRides: 3,
      completedRides: 2,
      cancelledRides: 1,
    });
    expect(baseBuilder.where).toHaveBeenCalledWith(
      'ride.passengerId = :userId',
      { userId: 'passenger-id' },
    );
    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'passenger-id' },
      select: { id: true, role: true },
    });
  });

  it('uses the existing fare defaults for each vehicle type until configured', async () => {
    const dataSource = {
      query: jest.fn().mockResolvedValue([]),
    } as unknown as DataSource;
    const service = new AdminService(
      dataSource,
      {} as unknown as DriverService,
      {
        get: jest.fn((_key: string, fallback: number) => fallback),
      } as unknown as ConfigService,
      { emitRideStatus: jest.fn() } as unknown as RideRealtimeGateway,
    );

    await expect(service.getPricingSettings()).resolves.toMatchObject({
      fuelPricePaisaPerLiter: 0,
      economyFuelEfficiencyKmPerLiter: 12,
      baseFarePaisa: 15000,
      perKmFarePaisa: 3500,
      perMinuteFarePaisa: 500,
      minimumFarePaisa: 20000,
      comfortFuelEfficiencyKmPerLiter: 10,
      comfortBaseFarePaisa: 18750,
      comfortPerKmFarePaisa: 4375,
      comfortPerMinuteFarePaisa: 625,
      comfortMinimumFarePaisa: 25000,
      xlFuelEfficiencyKmPerLiter: 8,
      xlBaseFarePaisa: 22500,
      xlPerKmFarePaisa: 5250,
      xlPerMinuteFarePaisa: 750,
      xlMinimumFarePaisa: 30000,
      bikeBaseFarePaisa: 15000,
      bikePerKmFarePaisa: 3500,
      bikePerMinuteFarePaisa: 500,
      bikeMinimumFarePaisa: 20000,
      rickshawBaseFarePaisa: 15000,
      rickshawPerKmFarePaisa: 3500,
      rickshawPerMinuteFarePaisa: 500,
      rickshawMinimumFarePaisa: 20000,
      updatedAt: null,
    });
  });
});
