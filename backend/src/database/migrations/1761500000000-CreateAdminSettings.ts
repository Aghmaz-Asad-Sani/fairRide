import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminSettings1761500000000 implements MigrationInterface {
  name = 'CreateAdminSettings1761500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "vehicles"
        ADD COLUMN "chassis_number" varchar(80),
        ADD COLUMN "engine_number" varchar(80)
    `);
    await queryRunner.query(`
      CREATE TABLE "pricing_settings" (
        "id" boolean NOT NULL DEFAULT true,
        "base_fare_paisa" integer NOT NULL,
        "per_km_fare_paisa" integer NOT NULL,
        "per_minute_fare_paisa" integer NOT NULL,
        "minimum_fare_paisa" integer NOT NULL,
        "updated_by" uuid,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pricing_settings" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_pricing_settings_singleton" CHECK ("id" = true),
        CONSTRAINT "CHK_pricing_settings_nonnegative" CHECK (
          "base_fare_paisa" >= 0 AND "per_km_fare_paisa" >= 0 AND
          "per_minute_fare_paisa" >= 0 AND "minimum_fare_paisa" >= 0
        ),
        CONSTRAINT "FK_pricing_settings_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "pricing_settings"`);
    await queryRunner.query(`
      ALTER TABLE "vehicles"
        DROP COLUMN "chassis_number",
        DROP COLUMN "engine_number"
    `);
  }
}
