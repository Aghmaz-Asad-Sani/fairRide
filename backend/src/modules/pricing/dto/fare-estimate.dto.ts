import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
} from 'class-validator';
import { VehicleCategory, VehicleType } from '../../drivers/vehicle.entity';

export class FareEstimateDto {
  @ApiProperty({ minimum: -90, maximum: 90 })
  @IsLatitude()
  pickupLatitude!: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @IsLongitude()
  pickupLongitude!: number;

  @ApiProperty({ minimum: -90, maximum: 90 })
  @IsLatitude()
  destinationLatitude!: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @IsLongitude()
  destinationLongitude!: number;

  @ApiProperty({ enum: VehicleCategory })
  @IsEnum(VehicleCategory)
  vehicleCategory!: VehicleCategory;

  @ApiProperty({ enum: VehicleType, default: VehicleType.CAR, required: false })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType: VehicleType = VehicleType.CAR;
}
