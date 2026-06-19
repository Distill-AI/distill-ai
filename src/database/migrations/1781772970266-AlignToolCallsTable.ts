import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignToolCallsTable1781772970266 implements MigrationInterface {
  name = 'AlignToolCallsTable1781772970266';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Extend tool_call_status enum with validation_error
    //    (timeout is excluded – V1 uses only ok/error/validation_error)
    await queryRunner.query(`
      ALTER TYPE "public"."tool_call_status" ADD VALUE IF NOT EXISTS 'validation_error'
    `);

    // 2. Change tool_name from enum to varchar(100) so the dynamic
    //    registry can register tools at startup without ALTER TYPE.
    //    The type-level ToolName boundary in the code excludes reserved
    //    identifiers (price/policy/score) at compile time.
    await queryRunner.query(`
      ALTER TABLE "tool_calls"
        ALTER COLUMN "tool_name" TYPE varchar(100)
        USING "tool_name"::text::varchar(100)
    `);

    // 3. Make latency_ms NOT NULL (update existing nulls first)
    await queryRunner.query(`
      UPDATE "tool_calls" SET "latency_ms" = 0 WHERE "latency_ms" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "tool_calls"
        ALTER COLUMN "latency_ms" SET NOT NULL
    `);

    // 4. Drop old tool_name enum type (no longer referenced)
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

    // Revert latency_ms to nullable
    await queryRunner.query(`
      ALTER TABLE "tool_calls" ALTER COLUMN "latency_ms" DROP NOT NULL
    `);

    // Revert tool_call_status enum (remove added values)
    await queryRunner.query(`
      UPDATE "tool_calls"
      SET "status" = 'error'
      WHERE "status" = 'validation_error'
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."tool_call_status_tmp" AS ENUM('ok', 'error');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
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
