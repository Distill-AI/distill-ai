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

    // 2. Create tool_tier enum type (idempotent)
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

    // 8. Set a default tier for existing rows, then make NOT NULL
    await queryRunner.query(`
      UPDATE "tool_calls" SET "tier" = 'internal' WHERE "tier" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "tool_calls"
        ALTER COLUMN "tier" SET NOT NULL
    `);

    // 9. Drop old columns no longer used by the entity
    await queryRunner.query(`
      ALTER TABLE "tool_calls"
        DROP COLUMN IF EXISTS "args",
        DROP COLUMN IF EXISTS "error_detail"
    `);

    // 10. Drop old tool_name enum type (no longer referenced)
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."tool_name"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-create tool_name enum type – dynamically include all values that exist
    // in the table to avoid cast failures for tools registered after the UP migration.
    await queryRunner.query(`
      DO $$
      DECLARE
        name_list TEXT;
      BEGIN
        SELECT STRING_AGG(DISTINCT QUOTE_LITERAL(val), ', ' ORDER BY QUOTE_LITERAL(val))
        INTO name_list
        FROM (
          SELECT tool_name AS val FROM tool_calls
          UNION
          SELECT unnest(
            ARRAY['extract_request', 'search_catalog', 'render_quote_pdf', 'explain_routing']
          )
        ) combined;

        IF name_list IS NOT NULL THEN
          EXECUTE 'CREATE TYPE "public"."tool_name" AS ENUM(' || name_list || ')';
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Revert tool_name back to enum type
    await queryRunner.query(`
      ALTER TABLE "tool_calls"
        ALTER COLUMN "tool_name" TYPE "public"."tool_name"
        USING "tool_name"::text::"public"."tool_name"
    `);

    // Re-create old columns (nullable so data can be migrated back)
    await queryRunner.query(`
      ALTER TABLE "tool_calls"
        ADD COLUMN IF NOT EXISTS "args" jsonb,
        ADD COLUMN IF NOT EXISTS "error_detail" jsonb
    `);
    await queryRunner.query(`
      UPDATE "tool_calls" SET
        "args" = COALESCE("input_args", 'null'::jsonb),
        "error_detail" = to_jsonb("error_message")
      WHERE "args" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "tool_calls"
        ALTER COLUMN "args" SET NOT NULL
    `);

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
      UPDATE "tool_calls" SET "request_id" = '00000000-0000-0000-0000-000000000000'
        WHERE "request_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "tool_calls" ALTER COLUMN "request_id" SET NOT NULL
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
    // Map new statuses to legacy values
    await queryRunner.query(`
      UPDATE "tool_calls"
      SET "status" = 'error'
      WHERE "status" IN ('timeout', 'validation_error')
    `);

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
