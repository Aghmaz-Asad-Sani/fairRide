import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum RideOfferStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

@Entity({ name: 'ride_offers' })
@Index('IDX_ride_offers_driver_status_expiry', [
  'driverId',
  'status',
  'expiresAt',
])
@Index('UQ_ride_offers_ride_driver', ['rideId', 'driverId'], { unique: true })
export class RideOffer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ride_id', type: 'uuid' })
  rideId!: string;

  @Column({ name: 'driver_id', type: 'uuid' })
  driverId!: string;

  @Column({ name: 'pickup_distance_m', type: 'integer' })
  pickupDistanceM!: number;

  @Column({
    type: 'enum',
    enum: RideOfferStatus,
    enumName: 'ride_offer_status',
    default: RideOfferStatus.PENDING,
  })
  status!: RideOfferStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
