import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthRateLimits1761400000000 implements MigrationInterface {
  name = 'CreateAuthRateLimits1761400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "auth_rate_limits" (
        "bucket" varchar(40) NOT NULL,
        "identifier_hash" char(64) NOT NULL,
        "request_count" integer NOT NULL,
        "expires_at" timestamptz NOT NULL,
        CONSTRAINT "PK_auth_rate_limits" PRIMARY KEY ("bucket", "identifier_hash"),
        CONSTRAINT "CHK_auth_rate_limits_count_positive"
          CHECK ("request_count" > 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_rate_limits_expires_at"
      ON "auth_rate_limits" ("expires_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "auth_rate_limits"`);
  }
}
