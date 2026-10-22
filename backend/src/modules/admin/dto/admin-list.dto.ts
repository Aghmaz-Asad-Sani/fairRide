import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RideStatus } from '../../rides/ride.entity';
import { DriverVerificationStatus } from '../../drivers/driver-profile.entity';
import { UserRole, UserStatus } from '../../users/user.entity';

export class AdminListDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsEnum(DriverVerificationStatus)
  verificationStatus?: DriverVerificationStatus;

  @IsOptional()
  @IsEnum(RideStatus)
  rideStatus?: RideStatus;
}
