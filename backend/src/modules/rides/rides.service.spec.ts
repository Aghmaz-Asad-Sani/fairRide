import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { VehicleCategory, VehicleType } from '../drivers/vehicle.entity';
import { UserRole, UserStatus } from '../users/user.entity';
import { PricingService } from '../pricing/pricing.service';
import { RoutingService } from '../maps/routing.service';
import { RideRealtimeGateway } from './ride-realtime.gateway';
import { RidesService } from './rides.service';

describe('RidesService distance limit', () => {
  function createService(distanceMeters: number) {
    const route = {
      distanceMeters,
      durationSeconds: 100,
      source: 'configured_routing_provider' as const,
      geometry: [
        { latitude: 31.5204, longitude: 74.3587 },
        { latitude: 24.8607, longitude: 67.0011 },
      ],
    };
    const config = {
      get: jest.fn((_key: string, fallback: number) =>
        _key === 'RIDE_MAX_DISTANCE_KM' ? 1400 : fallback,
      ),
      getOrThrow: jest.fn(() => 'a'.repeat(48)),
    } as unknown as ConfigService;
    const routing = {
      estimate: jest.fn().mockResolvedValue(route),
    } as unknown as RoutingService;
    const pricing = {
      estimateCurrent: jest.fn().mockResolvedValue({
        currency: 'PKR',
        distanceMeters,
        passengerTotalPaisa: 100000,
      }),
    } as unknown as PricingService;
    const service = new RidesService(
      {} as DataSource,
      routing,
      pricing,
      {} as RideRealtimeGateway,
      config,
    );
    return { service, pricing, route };
  }

  const passenger = {
    id: 'passenger-id',
    role: UserRole.PASSENGER,
    status: UserStatus.ACTIVE,
    sessionId: 'session-id',
  };
  const input = {
    pickupLatitude: 31.5204,
    pickupLongitude: 74.3587,
    destinationLatitude: 24.8607,
    destinationLongitude: 67.0011,
    vehicleCategory: VehicleCategory.ECONOMY,
    vehicleType: VehicleType.CAR,
  };

  it('allows intercity estimates up to the configured 1,400 km limit', async () => {
    const { service, route } = createService(1_399_000);

    await expect(service.estimateFare(passenger, input)).resolves.toMatchObject(
      {
        distanceMeters: 1_399_000,
        routeSource: 'configured_routing_provider',
        routeGeometry: route.geometry,
      },
    );
  });

  it('rejects estimate requests above the configured distance limit', async () => {
    const { service } = createService(1_400_001);

    await expect(service.estimateFare(passenger, input)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('keeps fare estimates restricted to passenger and driver accounts', async () => {
    const { service } = createService(5000);

    await expect(
      service.estimateFare({ ...passenger, role: UserRole.SUPER_ADMIN }, input),
    ).rejects.toThrow(ForbiddenException);
  });
});
