import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClarificationSentBy1782500000000 implements MigrationInterface {
  name = 'AddClarificationSentBy1782500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "clarifications" ADD COLUMN IF NOT EXISTS "sent_by" uuid`);
    await queryRunner.query(
      `ALTER TABLE "clarifications" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_clarifications_request_id" ON "clarifications" ("request_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_clarifications_request_id"`);
    await queryRunner.query(`ALTER TABLE "clarifications" DROP COLUMN IF EXISTS "sent_by"`);
    await queryRunner.query(`ALTER TABLE "clarifications" DROP COLUMN IF EXISTS "updated_at"`);
  }
}
