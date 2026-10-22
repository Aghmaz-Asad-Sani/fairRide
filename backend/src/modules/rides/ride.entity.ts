import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VehicleCategory, VehicleType } from '../drivers/vehicle.entity';
import type { FareBreakdown } from '../pricing/pricing.service';

export enum RideStatus {
  SEARCHING = 'SEARCHING',
  ACCEPTED = 'ACCEPTED',
  DRIVER_ARRIVING = 'DRIVER_ARRIVING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum RidePaymentMethod {
  CASH = 'CASH',
}

@Entity({ name: 'rides' })
@Index('IDX_rides_passenger_created', ['passengerId', 'createdAt'])
@Index('IDX_rides_driver_created', ['driverId', 'createdAt'])
@Index('IDX_rides_status_expires', ['status', 'expiresAt'])
@Check('CHK_rides_estimated_fare_nonnegative', '"estimated_fare_paisa" >= 0')
export class Ride {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'passenger_id', type: 'uuid' })
  passengerId!: string;

  @Column({ name: 'driver_id', type: 'uuid', nullable: true })
  driverId!: string | null;

  @Column({ type: 'enum', enum: RideStatus, enumName: 'ride_status' })
  status!: RideStatus;

  @Column({
    name: 'vehicle_category',
    type: 'enum',
    enum: VehicleCategory,
    enumName: 'vehicle_category',
  })
  vehicleCategory!: VehicleCategory;

  @Column({
    name: 'vehicle_type',
    type: 'enum',
    enum: VehicleType,
    enumName: 'vehicle_type',
    default: VehicleType.CAR,
  })
  vehicleType!: VehicleType;

  @Column({ name: 'pickup_latitude', type: 'double precision' })
  pickupLatitude!: number;

  @Column({ name: 'pickup_longitude', type: 'double precision' })
  pickupLongitude!: number;

  @Column({ name: 'pickup_label', type: 'varchar', length: 200 })
  pickupLabel!: string;

  @Column({ name: 'destination_latitude', type: 'double precision' })
  destinationLatitude!: number;

  @Column({ name: 'destination_longitude', type: 'double precision' })
  destinationLongitude!: number;

  @Column({ name: 'destination_label', type: 'varchar', length: 200 })
  destinationLabel!: string;

  @Column({ name: 'estimated_distance_m', type: 'integer' })
  estimatedDistanceM!: number;

  @Column({ name: 'estimated_duration_s', type: 'integer' })
  estimatedDurationS!: number;

  @Column({ name: 'estimated_fare_paisa', type: 'integer' })
  estimatedFarePaisa!: number;

  @Column({ name: 'fare_breakdown', type: 'jsonb' })
  fareBreakdown!: FareBreakdown;

  @Column({ name: 'route_source', type: 'varchar', length: 40 })
  routeSource!: string;

  @Column({ name: 'final_fare_paisa', type: 'integer', nullable: true })
  finalFarePaisa!: number | null;

  @Column({ type: 'varchar', length: 3, default: 'PKR' })
  currency!: string;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: RidePaymentMethod,
    enumName: 'ride_payment_method',
  })
  paymentMethod!: RidePaymentMethod;

  @Column({ name: 'pickup_pin_hash', type: 'char', length: 64, select: false })
  pickupPinHash!: string;

  @Column({ name: 'pickup_pin_encrypted', type: 'text', select: false })
  pickupPinEncrypted!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  idempotencyKey!: string;

  @Column({
    name: 'request_fingerprint',
    type: 'char',
    length: 64,
    select: false,
  })
  requestFingerprint!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'arrived_at', type: 'timestamptz', nullable: true })
  arrivedAt!: Date | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @Column({
    name: 'cancellation_reason',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  cancellationReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
