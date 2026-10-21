import { ConfigService } from '@nestjs/config';
import { VehicleCategory } from '../drivers/vehicle.entity';
import { PricingService } from './pricing.service';

describe('PricingService', () => {
  it('calculates fare in integer paisa and applies category multiplier', () => {
    const config = {
      get: jest.fn((_key: string, fallback: number) => fallback),
    } as unknown as ConfigService;
    const pricing = new PricingService(config);

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
});
