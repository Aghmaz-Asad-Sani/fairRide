import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOtpChallenges1761200000000 implements MigrationInterface {
  name = 'CreateOtpChallenges1761200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "phone_otp_challenges" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "code_hash" varchar(255) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "attempts" smallint NOT NULL DEFAULT 0,
        "consumed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_phone_otp_challenges_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_phone_otp_challenges_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_phone_otp_challenges_attempts"
          CHECK ("attempts" BETWEEN 0 AND 5)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_phone_otp_user_expiry"
      ON "phone_otp_challenges" ("user_id", "consumed_at", "expires_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "phone_otp_challenges"`);
  }
}
