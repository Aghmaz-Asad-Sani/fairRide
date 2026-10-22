import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../../database/audit-log.entity';
import { RolesGuard } from '../../common/roles.guard';
import { AuthController } from './auth.controller';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthSession } from './auth-session.entity';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../users/user.entity';
import { PhoneOtpChallenge } from './otp-challenge.entity';
import {
  DevelopmentOtpProvider,
  OtpDeliveryProvider,
} from './otp-delivery.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, AuthSession, AuditLog, PhoneOtpChallenge]),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    AuthRateLimitService,
    DevelopmentOtpProvider,
    { provide: OtpDeliveryProvider, useExisting: DevelopmentOtpProvider },
  ],
  exports: [AuthService, JwtModule, PassportModule, RolesGuard],
})
export class AuthModule {}
