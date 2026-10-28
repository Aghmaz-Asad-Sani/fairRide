import { Type } from 'class-transformer';
import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class PricingSettingsDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000)
  fuelPricePaisaPerLiter!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(200)
  economyFuelEfficiencyKmPerLiter!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  baseFarePaisa!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  perKmFarePaisa!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  perMinuteFarePaisa!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  minimumFarePaisa!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(200)
  comfortFuelEfficiencyKmPerLiter!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  comfortBaseFarePaisa!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  comfortPerKmFarePaisa!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  comfortPerMinuteFarePaisa!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  comfortMinimumFarePaisa!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(200)
  xlFuelEfficiencyKmPerLiter!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  xlBaseFarePaisa!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  xlPerKmFarePaisa!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  xlPerMinuteFarePaisa!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  xlMinimumFarePaisa!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  bikeBaseFarePaisa!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  bikePerKmFarePaisa!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  bikePerMinuteFarePaisa!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  bikeMinimumFarePaisa!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  rickshawBaseFarePaisa!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  rickshawPerKmFarePaisa!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  rickshawPerMinuteFarePaisa!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  rickshawMinimumFarePaisa!: number;
}
