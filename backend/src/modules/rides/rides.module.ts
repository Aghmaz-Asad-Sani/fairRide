import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../../database/audit-log.entity';
import { AuthModule } from '../auth/auth.module';
import { AuthSession } from '../auth/auth-session.entity';
import { DriversModule } from '../drivers/drivers.module';
import { DriverProfile } from '../drivers/driver-profile.entity';
import { HealthModule } from '../health/health.module';
import { RoutingService } from '../maps/routing.service';
import { PricingService } from '../pricing/pricing.service';
import { User } from '../users/user.entity';
import { Ride } from './ride.entity';
import { RideOffer } from './ride-offer.entity';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';
import { RideRealtimeGateway } from './ride-realtime.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ride,
      RideOffer,
      DriverProfile,
      User,
      AuditLog,
      AuthSession,
    ]),
    AuthModule,
    DriversModule,
    HealthModule,
  ],
  controllers: [RidesController],
  providers: [
    RidesService,
    RoutingService,
    PricingService,
    RideRealtimeGateway,
  ],
  exports: [RidesService],
})
export class RidesModule {}
