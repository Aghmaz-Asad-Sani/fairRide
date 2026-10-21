import 'dotenv/config';
import { DataSource } from 'typeorm';
import { AuthSession } from '../modules/auth/auth-session.entity';
import { User } from '../modules/users/user.entity';
import { AuditLog } from './audit-log.entity';
import { DriverProfile } from '../modules/drivers/driver-profile.entity';
import { Vehicle } from '../modules/drivers/vehicle.entity';
import { Ride } from '../modules/rides/ride.entity';
import { RideOffer } from '../modules/rides/ride-offer.entity';
import { PhoneOtpChallenge } from '../modules/auth/otp-challenge.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER ?? 'fairride',
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME ?? 'fairride',
  entities: [
    User,
    AuthSession,
    AuditLog,
    DriverProfile,
    Vehicle,
    Ride,
    RideOffer,
    PhoneOtpChallenge,
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
