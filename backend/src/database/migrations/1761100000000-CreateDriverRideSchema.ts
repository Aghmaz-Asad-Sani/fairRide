import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDriverRideSchema1761100000000 implements MigrationInterface {
  name = 'CreateDriverRideSchema1761100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "postgis"');
    await queryRunner.query(`
      CREATE TYPE "driver_verification_status" AS ENUM
      ('PENDING', 'APPROVED', 'REJECTED')
    `);
    await queryRunner.query(`
      CREATE TYPE "vehicle_category" AS ENUM ('ECONOMY', 'COMFORT', 'XL')
    `);
    await queryRunner.query(`
      CREATE TYPE "vehicle_verification_status" AS ENUM
      ('PENDING', 'APPROVED', 'REJECTED')
    `);
    await queryRunner.query(`
      CREATE TYPE "ride_status" AS ENUM
      ('SEARCHING', 'ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS',
       'COMPLETED', 'CANCELLED', 'EXPIRED')
    `);
    await queryRunner.query(`
      CREATE TYPE "ride_payment_method" AS ENUM ('CASH')
    `);
    await queryRunner.query(`
      CREATE TYPE "ride_offer_status" AS ENUM
      ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED')
    `);
    await queryRunner.query(`
      CREATE TABLE "driver_profiles" (
        "user_id" uuid NOT NULL,
        "verification_status" "driver_verification_status" NOT NULL DEFAULT 'PENDING',
        "license_number" varchar(80) NOT NULL,
        "license_expiry" date NOT NULL,
        "identity_verified" boolean NOT NULL DEFAULT false,
        "is_online" boolean NOT NULL DEFAULT false,
        "is_available" boolean NOT NULL DEFAULT false,
        "latitude" double precision,
        "longitude" double precision,
        "location_accuracy_m" real,
        "last_location_at" timestamptz,
        "completed_rides_count" integer NOT NULL DEFAULT 0,
        "rating_average" numeric(3,2) NOT NULL DEFAULT 0,
        "rating_count" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_driver_profiles_user_id" PRIMARY KEY ("user_id"),
        CONSTRAINT "FK_driver_profiles_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_driver_profiles_coordinates" CHECK (
          ("latitude" IS NULL AND "longitude" IS NULL) OR
          ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
        ),
        CONSTRAINT "CHK_driver_profiles_rating" CHECK (
          "rating_average" BETWEEN 0 AND 5 AND "rating_count" >= 0
        ),
        CONSTRAINT "CHK_driver_profiles_availability" CHECK (
          NOT "is_available" OR ("is_online" AND "verification_status" = 'APPROVED')
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_driver_profiles_eligibility"
      ON "driver_profiles" ("verification_status", "is_online", "is_available")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_driver_profiles_location_geography"
      ON "driver_profiles" USING GIST (
        (ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography)
      )
      WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE TABLE "vehicles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "driver_id" uuid NOT NULL,
        "category" "vehicle_category" NOT NULL,
        "make" varchar(60) NOT NULL,
        "model" varchar(60) NOT NULL,
        "model_year" smallint NOT NULL,
        "registration_number" varchar(20) NOT NULL,
        "color" varchar(40) NOT NULL,
        "passenger_capacity" smallint NOT NULL,
        "document_expires_at" date NOT NULL,
        "verification_status" "vehicle_verification_status" NOT NULL DEFAULT 'PENDING',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vehicles_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vehicles_registration_number" UNIQUE ("registration_number"),
        CONSTRAINT "FK_vehicles_driver_id" FOREIGN KEY ("driver_id")
          REFERENCES "driver_profiles"("user_id") ON DELETE CASCADE,
        CONSTRAINT "CHK_vehicles_model_year" CHECK ("model_year" BETWEEN 1990 AND 2100),
        CONSTRAINT "CHK_vehicles_capacity" CHECK ("passenger_capacity" BETWEEN 1 AND 8)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_vehicles_driver_active"
      ON "vehicles" ("driver_id", "is_active")
    `);
    await queryRunner.query(`
      CREATE TABLE "rides" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "passenger_id" uuid NOT NULL,
        "driver_id" uuid,
        "status" "ride_status" NOT NULL,
        "vehicle_category" "vehicle_category" NOT NULL,
        "pickup_latitude" double precision NOT NULL,
        "pickup_longitude" double precision NOT NULL,
        "pickup_label" varchar(200) NOT NULL,
        "destination_latitude" double precision NOT NULL,
        "destination_longitude" double precision NOT NULL,
        "destination_label" varchar(200) NOT NULL,
        "estimated_distance_m" integer NOT NULL,
        "estimated_duration_s" integer NOT NULL,
        "estimated_fare_paisa" integer NOT NULL,
        "fare_breakdown" jsonb NOT NULL,
        "route_source" varchar(40) NOT NULL,
        "final_fare_paisa" integer,
        "currency" varchar(3) NOT NULL DEFAULT 'PKR',
        "payment_method" "ride_payment_method" NOT NULL,
        "pickup_pin_hash" char(64) NOT NULL,
        "pickup_pin_encrypted" text NOT NULL,
        "idempotency_key" varchar(128) NOT NULL,
        "request_fingerprint" char(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "accepted_at" timestamptz,
        "arrived_at" timestamptz,
        "started_at" timestamptz,
        "completed_at" timestamptz,
        "cancelled_at" timestamptz,
        "cancellation_reason" varchar(80),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rides_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rides_passenger_id" FOREIGN KEY ("passenger_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_rides_driver_id" FOREIGN KEY ("driver_id")
          REFERENCES "driver_profiles"("user_id") ON DELETE RESTRICT,
        CONSTRAINT "UQ_rides_passenger_idempotency"
          UNIQUE ("passenger_id", "idempotency_key"),
        CONSTRAINT "CHK_rides_coordinates" CHECK (
          "pickup_latitude" BETWEEN -90 AND 90 AND
          "destination_latitude" BETWEEN -90 AND 90 AND
          "pickup_longitude" BETWEEN -180 AND 180 AND
          "destination_longitude" BETWEEN -180 AND 180
        ),
        CONSTRAINT "CHK_rides_estimates" CHECK (
          "estimated_distance_m" > 0 AND "estimated_duration_s" > 0 AND
          "estimated_fare_paisa" >= 0 AND
          ("final_fare_paisa" IS NULL OR "final_fare_paisa" >= 0)
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_rides_passenger_created"
      ON "rides" ("passenger_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_rides_driver_created"
      ON "rides" ("driver_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_rides_status_expires"
      ON "rides" ("status", "expires_at")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_rides_one_active_per_passenger"
      ON "rides" ("passenger_id")
      WHERE "status" IN ('SEARCHING', 'ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS')
    `);
    await queryRunner.query(`
      CREATE TABLE "ride_offers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ride_id" uuid NOT NULL,
        "driver_id" uuid NOT NULL,
        "pickup_distance_m" integer NOT NULL,
        "status" "ride_offer_status" NOT NULL DEFAULT 'PENDING',
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ride_offers_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ride_offers_ride_driver" UNIQUE ("ride_id", "driver_id"),
        CONSTRAINT "FK_ride_offers_ride_id" FOREIGN KEY ("ride_id")
          REFERENCES "rides"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ride_offers_driver_id" FOREIGN KEY ("driver_id")
          REFERENCES "driver_profiles"("user_id") ON DELETE CASCADE,
        CONSTRAINT "CHK_ride_offers_distance" CHECK ("pickup_distance_m" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ride_offers_driver_status_expiry"
      ON "ride_offers" ("driver_id", "status", "expires_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ride_offers"`);
    await queryRunner.query(`DROP TABLE "rides"`);
    await queryRunner.query(`DROP TABLE "vehicles"`);
    await queryRunner.query(`DROP TABLE "driver_profiles"`);
    await queryRunner.query(`DROP TYPE "ride_offer_status"`);
    await queryRunner.query(`DROP TYPE "ride_payment_method"`);
    await queryRunner.query(`DROP TYPE "ride_status"`);
    await queryRunner.query(`DROP TYPE "vehicle_verification_status"`);
    await queryRunner.query(`DROP TYPE "vehicle_category"`);
    await queryRunner.query(`DROP TYPE "driver_verification_status"`);
  }
}
