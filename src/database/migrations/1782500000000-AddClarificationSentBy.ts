import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClarificationSentBy1782500000000 implements MigrationInterface {
  name = 'AddClarificationSentBy1782500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "clarifications" ADD COLUMN IF NOT EXISTS "sent_by" uuid`);
    await queryRunner.query(
      `ALTER TABLE "clarifications" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `UPDATE "clarifications" SET "sent_by" = '00000000-0000-0000-0000-000000000000' WHERE "sent_at" IS NOT NULL AND "sent_by" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "clarifications" SET "sent_by" = NULL WHERE "sent_by" = '00000000-0000-0000-0000-000000000000'`,
    );
    await queryRunner.query(`ALTER TABLE "clarifications" DROP COLUMN IF EXISTS "sent_by"`);
    await queryRunner.query(`ALTER TABLE "clarifications" DROP COLUMN IF EXISTS "updated_at"`);
  }
}
