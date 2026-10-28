import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { RouteEstimate } from '../maps/routing.service';
import { VehicleCategory, VehicleType } from '../drivers/vehicle.entity';

export interface FareBreakdown {
  currency: 'PKR';
  distanceMeters: number;
  durationSeconds: number;
  staticDurationSeconds?: number;
  trafficDelaySeconds?: number;
  baseFarePaisa: number;
  distanceFarePaisa: number;
  timeFarePaisa: number;
  categoryMultiplierBasisPoints: number;
  passengerTotalPaisa: number;
  calculationType: 'estimate';
}

export interface PricingSettings {
  fuelPricePaisaPerLiter: number;
  economyFuelEfficiencyKmPerLiter: number;
  baseFarePaisa: number;
  perKmFarePaisa: number;
  perMinuteFarePaisa: number;
  minimumFarePaisa: number;
  comfortFuelEfficiencyKmPerLiter: number;
  comfortBaseFarePaisa: number;
  comfortPerKmFarePaisa: number;
  comfortPerMinuteFarePaisa: number;
  comfortMinimumFarePaisa: number;
  xlFuelEfficiencyKmPerLiter: number;
  xlBaseFarePaisa: number;
  xlPerKmFarePaisa: number;
  xlPerMinuteFarePaisa: number;
  xlMinimumFarePaisa: number;
  bikeBaseFarePaisa: number;
  bikePerKmFarePaisa: number;
  bikePerMinuteFarePaisa: number;
  bikeMinimumFarePaisa: number;
  rickshawBaseFarePaisa: number;
  rickshawPerKmFarePaisa: number;
  rickshawPerMinuteFarePaisa: number;
  rickshawMinimumFarePaisa: number;
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.every((row: unknown) => typeof row === 'object' && row !== null)
  );
}

function readPaisa(value: unknown, name: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Database returned invalid ${name}`);
  }
  return parsed;
}

function readEfficiency(value: unknown, name: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 200) {
    throw new Error(`Database returned invalid ${name}`);
  }
  return parsed;
}

interface FareRates {
  baseFarePaisa: number;
  perKmFarePaisa: number;
  perMinuteFarePaisa: number;
  minimumFarePaisa: number;
  fuelEfficiencyKmPerLiter: number | null;
}

@Injectable()
export class PricingService {
  private readonly defaults: PricingSettings;

  constructor(
    config: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    const baseFarePaisa = config.get<number>('FARE_BASE_PAISA', 15000);
    const perKmFarePaisa = config.get<number>('FARE_PER_KM_PAISA', 3500);
    const perMinuteFarePaisa = config.get<number>('FARE_PER_MINUTE_PAISA', 500);
    const minimumFarePaisa = config.get<number>('FARE_MINIMUM_PAISA', 20000);
    this.defaults = {
      fuelPricePaisaPerLiter: config.get<number>(
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
      bikeBaseFarePaisa: config.get<number>(
        'FARE_BIKE_BASE_PAISA',
        baseFarePaisa,
      ),
      bikePerKmFarePaisa: config.get<number>(
        'FARE_BIKE_PER_KM_PAISA',
        perKmFarePaisa,
      ),
      bikePerMinuteFarePaisa: config.get<number>(
        'FARE_BIKE_PER_MINUTE_PAISA',
        perMinuteFarePaisa,
      ),
      bikeMinimumFarePaisa: config.get<number>(
        'FARE_BIKE_MINIMUM_PAISA',
        minimumFarePaisa,
      ),
      rickshawBaseFarePaisa: config.get<number>(
        'FARE_RICKSHAW_BASE_PAISA',
        baseFarePaisa,
      ),
      rickshawPerKmFarePaisa: config.get<number>(
        'FARE_RICKSHAW_PER_KM_PAISA',
        perKmFarePaisa,
      ),
      rickshawPerMinuteFarePaisa: config.get<number>(
        'FARE_RICKSHAW_PER_MINUTE_PAISA',
        perMinuteFarePaisa,
      ),
      rickshawMinimumFarePaisa: config.get<number>(
        'FARE_RICKSHAW_MINIMUM_PAISA',
        minimumFarePaisa,
      ),
    };
  }

  estimate(
    route: RouteEstimate,
    category: VehicleCategory,
    vehicleType: VehicleType = VehicleType.CAR,
  ): FareBreakdown {
    return this.calculate(route, category, vehicleType, this.defaults);
  }

  async estimateCurrent(
    route: RouteEstimate,
    category: VehicleCategory,
    vehicleType: VehicleType = VehicleType.CAR,
  ): Promise<FareBreakdown> {
    const settingsRows: unknown = await this.dataSource.query(
      `SELECT fuel_price_paisa_per_liter,
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
              rickshaw_per_minute_fare_paisa, rickshaw_minimum_fare_paisa
       FROM pricing_settings WHERE id = true`,
    );
    if (!isRecordArray(settingsRows)) {
      throw new Error('Database returned invalid pricing settings');
    }
    const row = settingsRows[0];
    const settings = row
      ? {
          fuelPricePaisaPerLiter: readPaisa(
            row.fuel_price_paisa_per_liter,
            'fuel price',
          ),
          economyFuelEfficiencyKmPerLiter: readEfficiency(
            row.economy_fuel_efficiency_km_per_liter,
            'economy fuel efficiency',
          ),
          baseFarePaisa: readPaisa(row.base_fare_paisa, 'base fare'),
          perKmFarePaisa: readPaisa(row.per_km_fare_paisa, 'distance fare'),
          perMinuteFarePaisa: readPaisa(row.per_minute_fare_paisa, 'time fare'),
          minimumFarePaisa: readPaisa(row.minimum_fare_paisa, 'minimum fare'),
          comfortFuelEfficiencyKmPerLiter: readEfficiency(
            row.comfort_fuel_efficiency_km_per_liter,
            'comfort fuel efficiency',
          ),
          comfortBaseFarePaisa: readPaisa(
            row.comfort_base_fare_paisa,
            'comfort base fare',
          ),
          comfortPerKmFarePaisa: readPaisa(
            row.comfort_per_km_fare_paisa,
            'comfort distance fare',
          ),
          comfortPerMinuteFarePaisa: readPaisa(
            row.comfort_per_minute_fare_paisa,
            'comfort time fare',
          ),
          comfortMinimumFarePaisa: readPaisa(
            row.comfort_minimum_fare_paisa,
            'comfort minimum fare',
          ),
          xlFuelEfficiencyKmPerLiter: readEfficiency(
            row.xl_fuel_efficiency_km_per_liter,
            'XL fuel efficiency',
          ),
          xlBaseFarePaisa: readPaisa(row.xl_base_fare_paisa, 'XL base fare'),
          xlPerKmFarePaisa: readPaisa(
            row.xl_per_km_fare_paisa,
            'XL distance fare',
          ),
          xlPerMinuteFarePaisa: readPaisa(
            row.xl_per_minute_fare_paisa,
            'XL time fare',
          ),
          xlMinimumFarePaisa: readPaisa(
            row.xl_minimum_fare_paisa,
            'XL minimum fare',
          ),
          bikeBaseFarePaisa: readPaisa(
            row.bike_base_fare_paisa,
            'bike base fare',
          ),
          bikePerKmFarePaisa: readPaisa(
            row.bike_per_km_fare_paisa,
            'bike distance fare',
          ),
          bikePerMinuteFarePaisa: readPaisa(
            row.bike_per_minute_fare_paisa,
            'bike time fare',
          ),
          bikeMinimumFarePaisa: readPaisa(
            row.bike_minimum_fare_paisa,
            'bike minimum fare',
          ),
          rickshawBaseFarePaisa: readPaisa(
            row.rickshaw_base_fare_paisa,
            'rickshaw base fare',
          ),
          rickshawPerKmFarePaisa: readPaisa(
            row.rickshaw_per_km_fare_paisa,
            'rickshaw distance fare',
          ),
          rickshawPerMinuteFarePaisa: readPaisa(
            row.rickshaw_per_minute_fare_paisa,
            'rickshaw time fare',
          ),
          rickshawMinimumFarePaisa: readPaisa(
            row.rickshaw_minimum_fare_paisa,
            'rickshaw minimum fare',
          ),
        }
      : this.defaults;
    return this.calculate(route, category, vehicleType, settings);
  }

  private calculate(
    route: RouteEstimate,
    category: VehicleCategory,
    vehicleType: VehicleType,
    settings: PricingSettings,
  ): FareBreakdown {
    const rates: FareRates =
      vehicleType === VehicleType.CAR && category === VehicleCategory.COMFORT
        ? {
            baseFarePaisa: settings.comfortBaseFarePaisa,
            perKmFarePaisa: settings.comfortPerKmFarePaisa,
            perMinuteFarePaisa: settings.comfortPerMinuteFarePaisa,
            minimumFarePaisa: settings.comfortMinimumFarePaisa,
            fuelEfficiencyKmPerLiter: settings.comfortFuelEfficiencyKmPerLiter,
          }
        : vehicleType === VehicleType.CAR && category === VehicleCategory.XL
          ? {
              baseFarePaisa: settings.xlBaseFarePaisa,
              perKmFarePaisa: settings.xlPerKmFarePaisa,
              perMinuteFarePaisa: settings.xlPerMinuteFarePaisa,
              minimumFarePaisa: settings.xlMinimumFarePaisa,
              fuelEfficiencyKmPerLiter: settings.xlFuelEfficiencyKmPerLiter,
            }
          : vehicleType === VehicleType.CAR
            ? {
                baseFarePaisa: settings.baseFarePaisa,
                perKmFarePaisa: settings.perKmFarePaisa,
                perMinuteFarePaisa: settings.perMinuteFarePaisa,
                minimumFarePaisa: settings.minimumFarePaisa,
                fuelEfficiencyKmPerLiter:
                  settings.economyFuelEfficiencyKmPerLiter,
              }
            : vehicleType === VehicleType.BIKE
              ? {
                  baseFarePaisa: settings.bikeBaseFarePaisa,
                  perKmFarePaisa: settings.bikePerKmFarePaisa,
                  perMinuteFarePaisa: settings.bikePerMinuteFarePaisa,
                  minimumFarePaisa: settings.bikeMinimumFarePaisa,
                  fuelEfficiencyKmPerLiter: null,
                }
              : vehicleType === VehicleType.RICKSHAW
                ? {
                    baseFarePaisa: settings.rickshawBaseFarePaisa,
                    perKmFarePaisa: settings.rickshawPerKmFarePaisa,
                    perMinuteFarePaisa: settings.rickshawPerMinuteFarePaisa,
                    minimumFarePaisa: settings.rickshawMinimumFarePaisa,
                    fuelEfficiencyKmPerLiter: null,
                  }
                : {
                    baseFarePaisa: settings.baseFarePaisa,
                    perKmFarePaisa: settings.perKmFarePaisa,
                    perMinuteFarePaisa: settings.perMinuteFarePaisa,
                    minimumFarePaisa: settings.minimumFarePaisa,
                    fuelEfficiencyKmPerLiter:
                      settings.economyFuelEfficiencyKmPerLiter,
                  };
    if (
      vehicleType === VehicleType.CAR &&
      settings.fuelPricePaisaPerLiter <= 0
    ) {
      throw new Error(
        'Set a positive current fuel price in admin fare settings before estimating car fares',
      );
    }
    const fuelCostPerKmPaisa =
      vehicleType === VehicleType.CAR
        ? settings.fuelPricePaisaPerLiter /
          (rates.fuelEfficiencyKmPerLiter ?? 1)
        : 0;
    const distanceFarePaisa = Math.ceil(
      (route.distanceMeters * (rates.perKmFarePaisa + fuelCostPerKmPaisa)) /
        1000,
    );
    const timeFarePaisa = Math.ceil(
      (route.durationSeconds * rates.perMinuteFarePaisa) / 60,
    );
    const categoryMultiplierBasisPoints = 10000;
    const unrounded = rates.baseFarePaisa + distanceFarePaisa + timeFarePaisa;

    return {
      currency: 'PKR',
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      ...(route.staticDurationSeconds !== undefined
        ? {
            staticDurationSeconds: route.staticDurationSeconds,
            trafficDelaySeconds: Math.max(
              0,
              route.durationSeconds - route.staticDurationSeconds,
            ),
          }
        : {}),
      baseFarePaisa: rates.baseFarePaisa,
      distanceFarePaisa,
      timeFarePaisa,
      categoryMultiplierBasisPoints,
      passengerTotalPaisa: Math.max(rates.minimumFarePaisa, unrounded),
      calculationType: 'estimate',
    };
  }
}
