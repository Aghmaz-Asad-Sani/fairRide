import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConstrainCarPricingSettings1761800000000 implements MigrationInterface {
  name = 'ConstrainCarPricingSettings1761800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pricing_settings"
        ADD CONSTRAINT "CHK_pricing_settings_fuel_value_bounds" CHECK (
          "fuel_price_paisa_per_liter" BETWEEN 0 AND 1000000 AND
          "economy_fuel_efficiency_km_per_liter" BETWEEN 0.01 AND 200 AND
          "comfort_fuel_efficiency_km_per_liter" BETWEEN 0.01 AND 200 AND
          "xl_fuel_efficiency_km_per_liter" BETWEEN 0.01 AND 200
        ),
        ADD CONSTRAINT "CHK_pricing_settings_car_class_fares" CHECK (
          "comfort_base_fare_paisa" >= 0 AND
          "comfort_per_km_fare_paisa" >= 0 AND
          "comfort_per_minute_fare_paisa" >= 0 AND
          "comfort_minimum_fare_paisa" >= 0 AND
          "xl_base_fare_paisa" >= 0 AND
          "xl_per_km_fare_paisa" >= 0 AND
          "xl_per_minute_fare_paisa" >= 0 AND
          "xl_minimum_fare_paisa" >= 0
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pricing_settings"
        DROP CONSTRAINT "CHK_pricing_settings_fuel_value_bounds",
        DROP CONSTRAINT "CHK_pricing_settings_car_class_fares"
    `);
  }
}
