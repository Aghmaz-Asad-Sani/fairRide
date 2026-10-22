import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuthSession } from '../auth/auth-session.entity';
import { DriversModule } from '../drivers/drivers.module';
import { DriverProfile } from '../drivers/driver-profile.entity';
import { Vehicle } from '../drivers/vehicle.entity';
import { Ride } from '../rides/ride.entity';
import { RidesModule } from '../rides/rides.module';
import { User } from '../users/user.entity';
import { AuditLog } from '../../database/audit-log.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      AuthSession,
      Ride,
      DriverProfile,
      Vehicle,
      AuditLog,
    ]),
    AuthModule,
    DriversModule,
    RidesModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
