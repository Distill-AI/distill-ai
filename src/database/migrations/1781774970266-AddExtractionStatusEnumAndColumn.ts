import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExtractionStatusEnumAndColumn1781774970266 implements MigrationInterface {
  name = 'AddExtractionStatusEnumAndColumn1781774970266';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."extraction_status" AS ENUM('completed', 'failed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      ALTER TABLE "extractions"
        ADD COLUMN IF NOT EXISTS "status" "public"."extraction_status" NOT NULL DEFAULT 'completed'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "extractions" DROP COLUMN "status"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."extraction_status"
    `);
  }
}
