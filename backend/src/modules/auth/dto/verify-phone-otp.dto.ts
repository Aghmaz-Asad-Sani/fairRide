import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, Matches } from 'class-validator';

export class VerifyPhoneOtpDto {
  @ApiProperty()
  @IsUUID()
  challengeId!: string;

  @ApiProperty({ example: '482193' })
  @Matches(/^\d{6}$/)
  code!: string;
}
