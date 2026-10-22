import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVehicleTypeAndFourKmMatching1761300000000
  implements MigrationInterface
{
  name = 'AddVehicleTypeAndFourKmMatching1761300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "vehicle_type" AS ENUM ('CAR', 'BIKE', 'RICKSHAW')
    `);
    await queryRunner.query(`
      ALTER TABLE "vehicles"
      ADD COLUMN "vehicle_type" "vehicle_type" NOT NULL DEFAULT 'CAR'
    `);
    await queryRunner.query(`
      ALTER TABLE "rides"
      ADD COLUMN "vehicle_type" "vehicle_type" NOT NULL DEFAULT 'CAR'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "rides" DROP COLUMN "vehicle_type"');
    await queryRunner.query(
      'ALTER TABLE "vehicles" DROP COLUMN "vehicle_type"',
    );
    await queryRunner.query('DROP TYPE "vehicle_type"');
  }
}
