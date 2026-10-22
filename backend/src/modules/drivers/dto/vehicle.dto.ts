import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsString,
  IsOptional,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { VehicleCategory, VehicleType } from '../vehicle.entity';

export class CreateVehicleDto {
  @ApiProperty({ enum: VehicleCategory })
  @IsEnum(VehicleCategory)
  category!: VehicleCategory;

  @ApiProperty({ enum: VehicleType, default: VehicleType.CAR })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType: VehicleType = VehicleType.CAR;

  @ApiProperty({ maxLength: 60 })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  make!: string;

  @ApiProperty({ maxLength: 60 })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  model!: string;

  @ApiProperty({ minimum: 1990, maximum: 2100 })
  @IsInt()
  @Min(1990)
  @Max(2100)
  modelYear!: number;

  @ApiProperty({ maxLength: 20 })
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  registrationNumber!: string;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  chassisNumber!: string;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  engineNumber!: string;

  @ApiProperty({ maxLength: 40 })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  color!: string;

  @ApiProperty({ minimum: 1, maximum: 8 })
  @IsInt()
  @Min(1)
  @Max(8)
  passengerCapacity!: number;

  @ApiProperty({ example: '2030-12-31' })
  @IsDateString({ strict: true })
  documentExpiresAt!: string;
}
