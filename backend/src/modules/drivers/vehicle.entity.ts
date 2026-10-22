import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DriverProfile } from './driver-profile.entity';

export enum VehicleCategory {
  ECONOMY = 'ECONOMY',
  COMFORT = 'COMFORT',
  XL = 'XL',
}

export enum VehicleType {
  CAR = 'CAR',
  BIKE = 'BIKE',
  RICKSHAW = 'RICKSHAW',
}

export enum VehicleVerificationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity({ name: 'vehicles' })
@Index('IDX_vehicles_driver_active', ['driverId', 'isActive'])
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'driver_id', type: 'uuid' })
  driverId!: string;

  @ManyToOne(() => DriverProfile, (driver) => driver.vehicles, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'driver_id', referencedColumnName: 'userId' })
  driver!: DriverProfile;

  @Column({
    type: 'enum',
    enum: VehicleCategory,
    enumName: 'vehicle_category',
  })
  category!: VehicleCategory;

  @Column({
    name: 'vehicle_type',
    type: 'enum',
    enum: VehicleType,
    enumName: 'vehicle_type',
    default: VehicleType.CAR,
  })
  vehicleType!: VehicleType;

  @Column({ type: 'varchar', length: 60 })
  make!: string;

  @Column({ type: 'varchar', length: 60 })
  model!: string;

  @Column({ name: 'model_year', type: 'smallint' })
  modelYear!: number;

  @Column({
    name: 'registration_number',
    type: 'varchar',
    length: 20,
    unique: true,
  })
  registrationNumber!: string;

  @Column({
    name: 'chassis_number',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  chassisNumber!: string | null;

  @Column({
    name: 'engine_number',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  engineNumber!: string | null;

  @Column({ type: 'varchar', length: 40 })
  color!: string;

  @Column({ name: 'passenger_capacity', type: 'smallint' })
  passengerCapacity!: number;

  @Column({ name: 'document_expires_at', type: 'date' })
  documentExpiresAt!: string;

  @Column({
    name: 'verification_status',
    type: 'enum',
    enum: VehicleVerificationStatus,
    enumName: 'vehicle_verification_status',
    default: VehicleVerificationStatus.PENDING,
  })
  verificationStatus!: VehicleVerificationStatus;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
