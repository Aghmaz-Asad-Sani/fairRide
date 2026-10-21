import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class AvailabilityDto {
  @ApiProperty()
  @IsBoolean()
  online!: boolean;

  @ApiProperty()
  @IsBoolean()
  available!: boolean;
}
