import { ConfigService } from '@nestjs/config';
import { VehicleCategory, VehicleType } from '../drivers/vehicle.entity';
import { PricingService } from './pricing.service';

describe('PricingService', () => {
  const route = {
    distanceMeters: 2000,
    durationSeconds: 600,
    source: 'configured_routing_provider' as const,
  };

  function createService(dataSourceResult: unknown[] = []) {
    const config = {
      get: jest.fn((key: string, fallback: number) =>
        key === 'FUEL_PRICE_PAISA_PER_LITER' ? 30000 : fallback,
      ),
    } as unknown as ConfigService;
    const dataSource = {
      query: jest.fn().mockResolvedValue(dataSourceResult),
    } as unknown as import('typeorm').DataSource;
    return new PricingService(config, dataSource);
  }

  const settingsRow = {
    fuel_price_paisa_per_liter: 30000,
    economy_fuel_efficiency_km_per_liter: '10.00',
    base_fare_paisa: 10000,
    per_km_fare_paisa: 1000,
    per_minute_fare_paisa: 100,
    minimum_fare_paisa: 0,
    comfort_fuel_efficiency_km_per_liter: '5.00',
    comfort_base_fare_paisa: 20000,
    comfort_per_km_fare_paisa: 2000,
    comfort_per_minute_fare_paisa: 200,
    comfort_minimum_fare_paisa: 0,
    xl_fuel_efficiency_km_per_liter: '2.00',
    xl_base_fare_paisa: 30000,
    xl_per_km_fare_paisa: 3000,
    xl_per_minute_fare_paisa: 300,
    xl_minimum_fare_paisa: 0,
    bike_base_fare_paisa: 10000,
    bike_per_km_fare_paisa: 2000,
    bike_per_minute_fare_paisa: 100,
    bike_minimum_fare_paisa: 0,
    rickshaw_base_fare_paisa: 12000,
    rickshaw_per_km_fare_paisa: 2500,
    rickshaw_per_minute_fare_paisa: 200,
    rickshaw_minimum_fare_paisa: 0,
  };

  it('calculates the fuel-aware Economy fare in integer paisa', () => {
    const pricing = createService();

    expect(
      pricing.estimate(
        { ...route, distanceMeters: 5000 },
        VehicleCategory.ECONOMY,
      ),
    ).toEqual({
      currency: 'PKR',
      distanceMeters: 5000,
      durationSeconds: 600,
      baseFarePaisa: 15000,
      distanceFarePaisa: 30000,
      timeFarePaisa: 5000,
      categoryMultiplierBasisPoints: 10000,
      passengerTotalPaisa: 50000,
      calculationType: 'estimate',
    });
  });

  it('applies independent rates and fuel efficiency to each car class', async () => {
    const pricing = createService([settingsRow]);
    const estimates = await Promise.all(
      [
        VehicleCategory.ECONOMY,
        VehicleCategory.COMFORT,
        VehicleCategory.XL,
      ].map((category) => pricing.estimateCurrent(route, category)),
    );

    expect(estimates.map((estimate) => estimate.passengerTotalPaisa)).toEqual([
      19000, 38000, 69000,
    ]);
    expect(
      estimates.every(
        (estimate) => estimate.categoryMultiplierBasisPoints === 10000,
      ),
    ).toBe(true);
  });

  it('changes the car distance component when the configured fuel price changes', async () => {
    const higherFuelPrice = {
      ...settingsRow,
      fuel_price_paisa_per_liter: 60000,
    };
    const pricing = createService([higherFuelPrice]);

    await expect(
      pricing.estimateCurrent(route, VehicleCategory.ECONOMY),
    ).resolves.toMatchObject({
      distanceFarePaisa: 14000,
      passengerTotalPaisa: 25000,
    });
  });

  it('keeps independent bike rates and requires current fuel pricing for cars', async () => {
    const pricing = createService([settingsRow]);

    await expect(
      pricing.estimateCurrent(route, VehicleCategory.ECONOMY, VehicleType.BIKE),
    ).resolves.toMatchObject({
      baseFarePaisa: 10000,
      distanceFarePaisa: 4000,
      timeFarePaisa: 1000,
      categoryMultiplierBasisPoints: 10000,
      passengerTotalPaisa: 15000,
    });

    const noFuelPrice = createService([
      { ...settingsRow, fuel_price_paisa_per_liter: 0 },
    ]);
    await expect(
      noFuelPrice.estimateCurrent(route, VehicleCategory.ECONOMY),
    ).rejects.toThrow('Set a positive current fuel price');
  });
});
