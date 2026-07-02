import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuotePdfColumns1782530000000 implements MigrationInterface {
  name = 'AddQuotePdfColumns1782530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "pdf_storage_url" text`);
    await queryRunner.query(
      `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "pdf_generated_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "quotes" DROP COLUMN IF EXISTS "pdf_generated_at"`);
    await queryRunner.query(`ALTER TABLE "quotes" DROP COLUMN IF EXISTS "pdf_storage_url"`);
  }
}
