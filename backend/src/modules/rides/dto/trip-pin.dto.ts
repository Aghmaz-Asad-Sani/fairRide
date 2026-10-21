import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class TripPinDto {
  @ApiProperty({ example: '482193' })
  @Matches(/^\d{6}$/)
  pin!: string;
}
