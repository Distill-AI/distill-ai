import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignToolCallsTable1781772970266 implements MigrationInterface {
  name = 'AlignToolCallsTable1781772970266';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Extend tool_call_status enum with new values
    await queryRunner.query(`
      ALTER TYPE "public"."tool_call_status" ADD VALUE IF NOT EXISTS 'timeout'
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."tool_call_status" ADD VALUE IF NOT EXISTS 'validation_error'
    `);

    // 2. Create tool_tier enum type
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."tool_tier" AS ENUM('free', 'pro', 'enterprise', 'internal');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // 3. Add new columns (nullable initially to backfill)
    await queryRunner.query(`
      ALTER TABLE "tool_calls"
        ADD COLUMN IF NOT EXISTS "input_args" jsonb,
        ADD COLUMN IF NOT EXISTS "output_result" jsonb,
        ADD COLUMN IF NOT EXISTS "error_message" text,
        ADD COLUMN IF NOT EXISTS "tier" "public"."tool_tier"
    `);

    // 4. Migrate data from old columns to new columns
    await queryRunner.query(`
      UPDATE "tool_calls" SET
        "input_args" = "args",
        "error_message" = "error_detail"::text
      WHERE "input_args" IS NULL
    `);

    // 5. Change tool_name from enum to varchar(100)
    await queryRunner.query(`
      ALTER TABLE "tool_calls"
        ALTER COLUMN "tool_name" TYPE varchar(100)
        USING "tool_name"::text::varchar(100)
    `);

    // 6. Make request_id nullable
    await queryRunner.query(`
      ALTER TABLE "tool_calls"
        ALTER COLUMN "request_id" DROP NOT NULL
    `);

    // 7. Make latency_ms NOT NULL (update existing nulls first)
    await queryRunner.query(`
      UPDATE "tool_calls" SET "latency_ms" = 0 WHERE "latency_ms" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "tool_calls"
        ALTER COLUMN "latency_ms" SET NOT NULL
    `);

    // 8. Set a default tier for existing rows
    await queryRunner.query(`
      UPDATE "tool_calls" SET "tier" = 'internal' WHERE "tier" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "tool_calls"
        ALTER COLUMN "tier" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert tier to nullable
    await queryRunner.query(`
      ALTER TABLE "tool_calls" ALTER COLUMN "tier" DROP NOT NULL
    `);

    // Revert latency_ms to nullable
    await queryRunner.query(`
      ALTER TABLE "tool_calls" ALTER COLUMN "latency_ms" DROP NOT NULL
    `);

    // Revert request_id back to NOT NULL
    await queryRunner.query(`
      UPDATE "tool_calls" SET "request_id" = '00000000-0000-0000-0000-000000000000' WHERE "request_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "tool_calls" ALTER COLUMN "request_id" SET NOT NULL
    `);

    // Revert tool_name back to enum type
    await queryRunner.query(`
      CREATE TYPE "public"."tool_name_tmp" AS ENUM('extract_request', 'search_catalog', 'render_quote_pdf', 'explain_routing')
    `);
    await queryRunner.query(`
      ALTER TABLE "tool_calls"
        ALTER COLUMN "tool_name" TYPE "public"."tool_name_tmp"
        USING "tool_name"::text::"public"."tool_name_tmp"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."tool_name"
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."tool_name_tmp" RENAME TO "tool_name"
    `);

    // Drop new columns
    await queryRunner.query(`
      ALTER TABLE "tool_calls"
        DROP COLUMN IF EXISTS "tier",
        DROP COLUMN IF EXISTS "error_message",
        DROP COLUMN IF EXISTS "output_result",
        DROP COLUMN IF EXISTS "input_args"
    `);

    // Drop tool_tier type
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."tool_tier"
    `);

    // Revert tool_call_status enum (remove added values)
    // PostgreSQL doesn't support removing values from enums directly,
    // so we recreate the type
    await queryRunner.query(`
      CREATE TYPE "public"."tool_call_status_tmp" AS ENUM('ok', 'error')
    `);
    await queryRunner.query(`
      ALTER TABLE "tool_calls"
        ALTER COLUMN "status" TYPE "public"."tool_call_status_tmp"
        USING "status"::text::"public"."tool_call_status_tmp"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."tool_call_status"
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."tool_call_status_tmp" RENAME TO "tool_call_status"
    `);
  }
}
