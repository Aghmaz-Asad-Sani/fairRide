import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Opaque, single-use rotating refresh token' })
  @IsString()
  @MinLength(80)
  @MaxLength(160)
  refreshToken!: string;
}
