import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../../database/audit-log.entity';
import { AuthModule } from '../auth/auth.module';
import { DriverController } from './driver.controller';
import { DriverProfile } from './driver-profile.entity';
import { DriverService } from './driver.service';
import { Vehicle } from './vehicle.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DriverProfile, Vehicle, AuditLog]),
    AuthModule,
  ],
  controllers: [DriverController],
  providers: [DriverService],
  exports: [DriverService],
})
export class DriversModule {}
