import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const CANCELLATION_REASONS = [
  'CHANGED_MIND',
  'WRONG_PICKUP',
  'LONG_WAIT',
  'DRIVER_REQUESTED',
  'PASSENGER_UNAVAILABLE',
  'VEHICLE_ISSUE',
  'OTHER',
] as const;

export class CancelRideDto {
  @ApiProperty({ enum: CANCELLATION_REASONS })
  @IsIn(CANCELLATION_REASONS)
  reason!: (typeof CANCELLATION_REASONS)[number];
}
