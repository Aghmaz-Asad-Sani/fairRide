import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { RouteEstimate } from '../maps/routing.service';
import { VehicleCategory } from '../drivers/vehicle.entity';

export interface FareBreakdown {
  currency: 'PKR';
  distanceMeters: number;
  durationSeconds: number;
  baseFarePaisa: number;
  distanceFarePaisa: number;
  timeFarePaisa: number;
  categoryMultiplierBasisPoints: number;
  passengerTotalPaisa: number;
  calculationType: 'estimate';
}

export interface PricingSettings {
  baseFarePaisa: number;
  perKmFarePaisa: number;
  perMinuteFarePaisa: number;
  minimumFarePaisa: number;
}

const CATEGORY_MULTIPLIER: Record<VehicleCategory, number> = {
  [VehicleCategory.ECONOMY]: 10000,
  [VehicleCategory.COMFORT]: 12500,
  [VehicleCategory.XL]: 15000,
};

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

@Injectable()
export class PricingService {
  private readonly baseFare: number;
  private readonly perKmFare: number;
  private readonly perMinuteFare: number;
  private readonly minimumFare: number;

  constructor(
    config: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.baseFare = config.get<number>('FARE_BASE_PAISA', 15000);
    this.perKmFare = config.get<number>('FARE_PER_KM_PAISA', 3500);
    this.perMinuteFare = config.get<number>('FARE_PER_MINUTE_PAISA', 500);
    this.minimumFare = config.get<number>('FARE_MINIMUM_PAISA', 20000);
  }

  estimate(route: RouteEstimate, category: VehicleCategory): FareBreakdown {
    return this.calculate(route, category, {
      baseFarePaisa: this.baseFare,
      perKmFarePaisa: this.perKmFare,
      perMinuteFarePaisa: this.perMinuteFare,
      minimumFarePaisa: this.minimumFare,
    });
  }

  async estimateCurrent(
    route: RouteEstimate,
    category: VehicleCategory,
  ): Promise<FareBreakdown> {
    const settingsRows: unknown = await this.dataSource.query(
      `SELECT base_fare_paisa, per_km_fare_paisa,
              per_minute_fare_paisa, minimum_fare_paisa
       FROM pricing_settings WHERE id = true`,
    );
    if (!isRecordArray(settingsRows)) {
      throw new Error('Database returned invalid pricing settings');
    }
    const row = settingsRows[0];
    return this.calculate(route, category, {
      baseFarePaisa: row
        ? readPaisa(row.base_fare_paisa, 'base fare')
        : this.baseFare,
      perKmFarePaisa: row
        ? readPaisa(row.per_km_fare_paisa, 'distance fare')
        : this.perKmFare,
      perMinuteFarePaisa: row
        ? readPaisa(row.per_minute_fare_paisa, 'time fare')
        : this.perMinuteFare,
      minimumFarePaisa: row
        ? readPaisa(row.minimum_fare_paisa, 'minimum fare')
        : this.minimumFare,
    });
  }

  private calculate(
    route: RouteEstimate,
    category: VehicleCategory,
    settings: PricingSettings,
  ): FareBreakdown {
    const distanceFarePaisa = Math.ceil(
      (route.distanceMeters * settings.perKmFarePaisa) / 1000,
    );
    const timeFarePaisa = Math.ceil(
      (route.durationSeconds * settings.perMinuteFarePaisa) / 60,
    );
    const categoryMultiplierBasisPoints = CATEGORY_MULTIPLIER[category];
    const unrounded = Math.ceil(
      ((settings.baseFarePaisa + distanceFarePaisa + timeFarePaisa) *
        categoryMultiplierBasisPoints) /
        10000,
    );

    return {
      currency: 'PKR',
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      baseFarePaisa: settings.baseFarePaisa,
      distanceFarePaisa,
      timeFarePaisa,
      categoryMultiplierBasisPoints,
      passengerTotalPaisa: Math.max(settings.minimumFarePaisa, unrounded),
      calculationType: 'estimate',
    };
  }
}
