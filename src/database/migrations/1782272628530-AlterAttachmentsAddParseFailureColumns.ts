import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterAttachmentsAddParseFailureColumns1782272628530 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."attachment_parse_status"
          AS ENUM('unparsed', 'parsed', 'manual_paste');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."attachment_parse_error_reason"
          AS ENUM('corrupt', 'no_text_layer', 'unsupported_format', 'size_limit_exceeded', 'unknown');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "attachments"
        ADD COLUMN IF NOT EXISTS "parse_status" "public"."attachment_parse_status"
          NOT NULL DEFAULT 'unparsed',
        ADD COLUMN IF NOT EXISTS "parse_error_reason" "public"."attachment_parse_error_reason",
        ADD COLUMN IF NOT EXISTS "raw_text" text,
        ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "attachments"
        DROP COLUMN IF EXISTS "parse_status",
        DROP COLUMN IF EXISTS "parse_error_reason",
        DROP COLUMN IF EXISTS "raw_text",
        DROP COLUMN IF EXISTS "updated_at";
    `);

    await queryRunner.query(`DROP TYPE IF EXISTS "public"."attachment_parse_status";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."attachment_parse_error_reason";`);
  }
}
