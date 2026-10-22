import { ConfigService } from '@nestjs/config';
import { VehicleCategory } from '../drivers/vehicle.entity';
import { PricingService } from './pricing.service';

describe('PricingService', () => {
  it('calculates fare in integer paisa and applies category multiplier', () => {
    const config = {
      get: jest.fn((_key: string, fallback: number) => fallback),
    } as unknown as ConfigService;
    const dataSource = {
      query: jest.fn().mockResolvedValue([]),
    } as unknown as import('typeorm').DataSource;
    const pricing = new PricingService(config, dataSource);

    expect(
      pricing.estimate(
        {
          distanceMeters: 5000,
          durationSeconds: 600,
          source: 'development_estimate',
        },
        VehicleCategory.COMFORT,
      ),
    ).toEqual({
      currency: 'PKR',
      distanceMeters: 5000,
      durationSeconds: 600,
      baseFarePaisa: 15000,
      distanceFarePaisa: 17500,
      timeFarePaisa: 5000,
      categoryMultiplierBasisPoints: 12500,
      passengerTotalPaisa: 46875,
      calculationType: 'estimate',
    });
  });

  it('uses admin-updated database settings for new estimates', async () => {
    const config = {
      get: jest.fn((_key: string, fallback: number) => fallback),
    } as unknown as ConfigService;
    const dataSource = {
      query: jest.fn().mockResolvedValue([
        {
          base_fare_paisa: 30000,
          per_km_fare_paisa: 4000,
          per_minute_fare_paisa: 0,
          minimum_fare_paisa: 25000,
        },
      ]),
    } as unknown as import('typeorm').DataSource;
    const pricing = new PricingService(config, dataSource);

    await expect(
      pricing.estimateCurrent(
        {
          distanceMeters: 5000,
          durationSeconds: 600,
          source: 'development_estimate',
        },
        VehicleCategory.ECONOMY,
      ),
    ).resolves.toMatchObject({
      baseFarePaisa: 30000,
      distanceFarePaisa: 20000,
      timeFarePaisa: 0,
      passengerTotalPaisa: 50000,
    });
  });
});
