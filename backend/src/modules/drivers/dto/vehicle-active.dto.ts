import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class VehicleActiveDto {
  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;
}
