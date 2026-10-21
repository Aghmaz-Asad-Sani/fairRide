import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

const CATEGORY_MULTIPLIER: Record<VehicleCategory, number> = {
  [VehicleCategory.ECONOMY]: 10000,
  [VehicleCategory.COMFORT]: 12500,
  [VehicleCategory.XL]: 15000,
};

@Injectable()
export class PricingService {
  private readonly baseFare: number;
  private readonly perKmFare: number;
  private readonly perMinuteFare: number;
  private readonly minimumFare: number;

  constructor(config: ConfigService) {
    this.baseFare = config.get<number>('FARE_BASE_PAISA', 15000);
    this.perKmFare = config.get<number>('FARE_PER_KM_PAISA', 3500);
    this.perMinuteFare = config.get<number>('FARE_PER_MINUTE_PAISA', 500);
    this.minimumFare = config.get<number>('FARE_MINIMUM_PAISA', 20000);
  }

  estimate(route: RouteEstimate, category: VehicleCategory): FareBreakdown {
    const distanceFarePaisa = Math.ceil(
      (route.distanceMeters * this.perKmFare) / 1000,
    );
    const timeFarePaisa = Math.ceil(
      (route.durationSeconds * this.perMinuteFare) / 60,
    );
    const categoryMultiplierBasisPoints = CATEGORY_MULTIPLIER[category];
    const unrounded = Math.ceil(
      ((this.baseFare + distanceFarePaisa + timeFarePaisa) *
        categoryMultiplierBasisPoints) /
        10000,
    );

    return {
      currency: 'PKR',
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      baseFarePaisa: this.baseFare,
      distanceFarePaisa,
      timeFarePaisa,
      categoryMultiplierBasisPoints,
      passengerTotalPaisa: Math.max(this.minimumFare, unrounded),
      calculationType: 'estimate',
    };
  }
}
