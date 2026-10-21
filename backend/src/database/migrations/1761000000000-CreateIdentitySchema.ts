import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIdentitySchema1761000000000 implements MigrationInterface {
  name = 'CreateIdentitySchema1761000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "user_role" AS ENUM (
        'PASSENGER', 'DRIVER', 'SUPPORT', 'ADMIN', 'SUPER_ADMIN'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "user_status" AS ENUM (
        'ACTIVE', 'SUSPENDED', 'DELETION_REQUESTED'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(100) NOT NULL,
        "phone" varchar(16) NOT NULL,
        "email" varchar(254),
        "password_hash" varchar(255) NOT NULL,
        "role" "user_role" NOT NULL,
        "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
        "phone_verified_at" timestamptz,
        "preferred_language" varchar(12) NOT NULL DEFAULT 'en',
        "profile_image_url" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_phone" UNIQUE ("phone"),
        CONSTRAINT "CHK_users_phone_pak_mobile" CHECK ("phone" ~ '^\\+923[0-9]{9}$'),
        CONSTRAINT "CHK_users_name_not_blank" CHECK (length(trim("name")) > 0)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_users_email_lower"
      ON "users" (lower("email")) WHERE "email" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_users_role_status" ON "users" ("role", "status")
    `);
    await queryRunner.query(`
      CREATE TABLE "auth_sessions" (
        "id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "refresh_token_hash" char(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "last_used_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auth_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_auth_sessions_refresh_token_hash" UNIQUE ("refresh_token_hash"),
        CONSTRAINT "FK_auth_sessions_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_sessions_user_active"
      ON "auth_sessions" ("user_id", "revoked_at", "expires_at")
    `);
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "actor_id" uuid,
        "event_type" varchar(80) NOT NULL,
        "target_id" uuid,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_actor_created"
      ON "audit_logs" ("actor_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_event_created"
      ON "audit_logs" ("event_type", "created_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "auth_sessions"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "user_status"`);
    await queryRunner.query(`DROP TYPE "user_role"`);
  }
}
