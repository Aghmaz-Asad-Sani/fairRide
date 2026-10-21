import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../users/user.entity';

export class RegisterDto {
  @ApiProperty({ example: 'Ayesha Khan', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/)
  name!: string;

  @ApiProperty({ example: '+923001234567' })
  @IsString()
  @MinLength(7)
  @MaxLength(32)
  phone!: string;

  @ApiPropertyOptional({ example: 'ayesha@example.com', maxLength: 254 })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({
    enum: [UserRole.PASSENGER, UserRole.DRIVER],
    default: UserRole.PASSENGER,
  })
  @IsOptional()
  @IsIn([UserRole.PASSENGER, UserRole.DRIVER])
  role?: UserRole.PASSENGER | UserRole.DRIVER;
}
