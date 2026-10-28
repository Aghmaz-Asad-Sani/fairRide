import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVehicleFareSettingsAndIntercityLimit1761600000000 implements MigrationInterface {
  name = 'AddVehicleFareSettingsAndIntercityLimit1761600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pricing_settings"
        ADD COLUMN "bike_base_fare_paisa" integer NOT NULL DEFAULT 15000,
        ADD COLUMN "bike_per_km_fare_paisa" integer NOT NULL DEFAULT 3500,
        ADD COLUMN "bike_per_minute_fare_paisa" integer NOT NULL DEFAULT 500,
        ADD COLUMN "bike_minimum_fare_paisa" integer NOT NULL DEFAULT 20000,
        ADD COLUMN "rickshaw_base_fare_paisa" integer NOT NULL DEFAULT 15000,
        ADD COLUMN "rickshaw_per_km_fare_paisa" integer NOT NULL DEFAULT 3500,
        ADD COLUMN "rickshaw_per_minute_fare_paisa" integer NOT NULL DEFAULT 500,
        ADD COLUMN "rickshaw_minimum_fare_paisa" integer NOT NULL DEFAULT 20000
    `);
    await queryRunner.query(`
      UPDATE "pricing_settings"
      SET "bike_base_fare_paisa" = "base_fare_paisa",
          "bike_per_km_fare_paisa" = "per_km_fare_paisa",
          "bike_per_minute_fare_paisa" = "per_minute_fare_paisa",
          "bike_minimum_fare_paisa" = "minimum_fare_paisa",
          "rickshaw_base_fare_paisa" = "base_fare_paisa",
          "rickshaw_per_km_fare_paisa" = "per_km_fare_paisa",
          "rickshaw_per_minute_fare_paisa" = "per_minute_fare_paisa",
          "rickshaw_minimum_fare_paisa" = "minimum_fare_paisa"
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_settings"
        ADD CONSTRAINT "CHK_pricing_settings_vehicle_nonnegative" CHECK (
          "bike_base_fare_paisa" >= 0 AND
          "bike_per_km_fare_paisa" >= 0 AND
          "bike_per_minute_fare_paisa" >= 0 AND
          "bike_minimum_fare_paisa" >= 0 AND
          "rickshaw_base_fare_paisa" >= 0 AND
          "rickshaw_per_km_fare_paisa" >= 0 AND
          "rickshaw_per_minute_fare_paisa" >= 0 AND
          "rickshaw_minimum_fare_paisa" >= 0
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pricing_settings"
        DROP CONSTRAINT "CHK_pricing_settings_vehicle_nonnegative",
        DROP COLUMN "bike_base_fare_paisa",
        DROP COLUMN "bike_per_km_fare_paisa",
        DROP COLUMN "bike_per_minute_fare_paisa",
        DROP COLUMN "bike_minimum_fare_paisa",
        DROP COLUMN "rickshaw_base_fare_paisa",
        DROP COLUMN "rickshaw_per_km_fare_paisa",
        DROP COLUMN "rickshaw_per_minute_fare_paisa",
        DROP COLUMN "rickshaw_minimum_fare_paisa"
    `);
  }
}
