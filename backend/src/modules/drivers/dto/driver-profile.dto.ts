import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class DriverProfileDto {
  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  licenseNumber!: string;

  @ApiProperty({ example: '2030-12-31' })
  @IsDateString({ strict: true })
  licenseExpiry!: string;
}
