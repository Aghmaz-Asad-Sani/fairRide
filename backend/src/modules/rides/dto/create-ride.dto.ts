import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { VehicleCategory } from '../../drivers/vehicle.entity';

export class CreateRideDto {
  @ApiProperty({ minimum: -90, maximum: 90 })
  @IsLatitude()
  pickupLatitude!: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @IsLongitude()
  pickupLongitude!: number;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  pickupLabel!: string;

  @ApiProperty({ minimum: -90, maximum: 90 })
  @IsLatitude()
  destinationLatitude!: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @IsLongitude()
  destinationLongitude!: number;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  destinationLabel!: string;

  @ApiProperty({ enum: VehicleCategory })
  @IsEnum(VehicleCategory)
  vehicleCategory!: VehicleCategory;
}
