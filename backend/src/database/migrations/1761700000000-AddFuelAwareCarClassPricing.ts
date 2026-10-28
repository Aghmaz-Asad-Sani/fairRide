import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFuelAwareCarClassPricing1761700000000 implements MigrationInterface {
  name = 'AddFuelAwareCarClassPricing1761700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pricing_settings"
        ADD COLUMN "fuel_price_paisa_per_liter" integer NOT NULL DEFAULT 0,
        ADD COLUMN "economy_fuel_efficiency_km_per_liter" numeric(6, 2) NOT NULL DEFAULT 12,
        ADD COLUMN "comfort_fuel_efficiency_km_per_liter" numeric(6, 2) NOT NULL DEFAULT 10,
        ADD COLUMN "comfort_base_fare_paisa" integer,
        ADD COLUMN "comfort_per_km_fare_paisa" integer,
        ADD COLUMN "comfort_per_minute_fare_paisa" integer,
        ADD COLUMN "comfort_minimum_fare_paisa" integer,
        ADD COLUMN "xl_fuel_efficiency_km_per_liter" numeric(6, 2) NOT NULL DEFAULT 8,
        ADD COLUMN "xl_base_fare_paisa" integer,
        ADD COLUMN "xl_per_km_fare_paisa" integer,
        ADD COLUMN "xl_per_minute_fare_paisa" integer,
        ADD COLUMN "xl_minimum_fare_paisa" integer
    `);
    await queryRunner.query(`
      UPDATE "pricing_settings"
      SET comfort_base_fare_paisa = CEIL(base_fare_paisa * 1.25)::integer,
          comfort_per_km_fare_paisa = CEIL(per_km_fare_paisa * 1.25)::integer,
          comfort_per_minute_fare_paisa = CEIL(per_minute_fare_paisa * 1.25)::integer,
          comfort_minimum_fare_paisa = CEIL(minimum_fare_paisa * 1.25)::integer,
          xl_base_fare_paisa = CEIL(base_fare_paisa * 1.5)::integer,
          xl_per_km_fare_paisa = CEIL(per_km_fare_paisa * 1.5)::integer,
          xl_per_minute_fare_paisa = CEIL(per_minute_fare_paisa * 1.5)::integer,
          xl_minimum_fare_paisa = CEIL(minimum_fare_paisa * 1.5)::integer
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_settings"
        ALTER COLUMN "comfort_base_fare_paisa" SET NOT NULL,
        ALTER COLUMN "comfort_per_km_fare_paisa" SET NOT NULL,
        ALTER COLUMN "comfort_per_minute_fare_paisa" SET NOT NULL,
        ALTER COLUMN "comfort_minimum_fare_paisa" SET NOT NULL,
        ALTER COLUMN "xl_base_fare_paisa" SET NOT NULL,
        ALTER COLUMN "xl_per_km_fare_paisa" SET NOT NULL,
        ALTER COLUMN "xl_per_minute_fare_paisa" SET NOT NULL,
        ALTER COLUMN "xl_minimum_fare_paisa" SET NOT NULL,
        ADD CONSTRAINT "CHK_pricing_settings_fuel_values" CHECK (
          "fuel_price_paisa_per_liter" >= 0 AND
          "economy_fuel_efficiency_km_per_liter" > 0 AND
          "comfort_fuel_efficiency_km_per_liter" > 0 AND
          "xl_fuel_efficiency_km_per_liter" > 0
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pricing_settings"
        DROP CONSTRAINT "CHK_pricing_settings_fuel_values",
        DROP COLUMN "fuel_price_paisa_per_liter",
        DROP COLUMN "economy_fuel_efficiency_km_per_liter",
        DROP COLUMN "comfort_fuel_efficiency_km_per_liter",
        DROP COLUMN "comfort_base_fare_paisa",
        DROP COLUMN "comfort_per_km_fare_paisa",
        DROP COLUMN "comfort_per_minute_fare_paisa",
        DROP COLUMN "comfort_minimum_fare_paisa",
        DROP COLUMN "xl_fuel_efficiency_km_per_liter",
        DROP COLUMN "xl_base_fare_paisa",
        DROP COLUMN "xl_per_km_fare_paisa",
        DROP COLUMN "xl_per_minute_fare_paisa",
        DROP COLUMN "xl_minimum_fare_paisa"
    `);
  }
}
