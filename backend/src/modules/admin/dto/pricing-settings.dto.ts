import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class PricingSettingsDto {
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
}
