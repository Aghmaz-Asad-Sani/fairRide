import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Vehicle } from './vehicle.entity';

export enum DriverVerificationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity({ name: 'driver_profiles' })
@Index('IDX_driver_profiles_eligibility', [
  'verificationStatus',
  'isOnline',
  'isAvailable',
])
export class DriverProfile {
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    name: 'verification_status',
    type: 'enum',
    enum: DriverVerificationStatus,
    enumName: 'driver_verification_status',
    default: DriverVerificationStatus.PENDING,
  })
  verificationStatus!: DriverVerificationStatus;

  @Column({ name: 'license_number', type: 'varchar', length: 80 })
  licenseNumber!: string;

  @Column({ name: 'license_expiry', type: 'date' })
  licenseExpiry!: string;

  @Column({ name: 'identity_verified', type: 'boolean', default: false })
  identityVerified!: boolean;

  @Column({ name: 'is_online', type: 'boolean', default: false })
  isOnline!: boolean;

  @Column({ name: 'is_available', type: 'boolean', default: false })
  isAvailable!: boolean;

  @Column({ type: 'double precision', nullable: true })
  latitude!: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude!: number | null;

  @Column({ name: 'location_accuracy_m', type: 'real', nullable: true })
  locationAccuracyM!: number | null;

  @Column({ name: 'last_location_at', type: 'timestamptz', nullable: true })
  lastLocationAt!: Date | null;

  @Column({
    name: 'completed_rides_count',
    type: 'integer',
    default: 0,
  })
  completedRidesCount!: number;

  @Column({
    name: 'rating_average',
    type: 'numeric',
    precision: 3,
    scale: 2,
    default: 0,
  })
  ratingAverage!: string;

  @Column({ name: 'rating_count', type: 'integer', default: 0 })
  ratingCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => Vehicle, (vehicle) => vehicle.driver)
  vehicles!: Vehicle[];
}
