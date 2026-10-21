import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { DriverVerificationStatus } from '../driver-profile.entity';
import { VehicleVerificationStatus } from '../vehicle.entity';

export class DriverVerificationDto {
  @ApiProperty({
    enum: [
      DriverVerificationStatus.APPROVED,
      DriverVerificationStatus.REJECTED,
    ],
  })
  @IsEnum(DriverVerificationStatus)
  status!:
    DriverVerificationStatus.APPROVED | DriverVerificationStatus.REJECTED;
}

export class VehicleVerificationDto {
  @ApiProperty({
    enum: [
      VehicleVerificationStatus.APPROVED,
      VehicleVerificationStatus.REJECTED,
    ],
  })
  @IsEnum(VehicleVerificationStatus)
  status!:
    VehicleVerificationStatus.APPROVED | VehicleVerificationStatus.REJECTED;
}
