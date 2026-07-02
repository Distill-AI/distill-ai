import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuoteEmailDraftColumns1782540000000 implements MigrationInterface {
  name = 'AddQuoteEmailDraftColumns1782540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "email_draft_subject" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "email_draft_body" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "quotes" DROP COLUMN IF EXISTS "email_draft_body"`);
    await queryRunner.query(`ALTER TABLE "quotes" DROP COLUMN IF EXISTS "email_draft_subject"`);
  }
}
