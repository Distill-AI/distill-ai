import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClassificationConfidence1781772970268 implements MigrationInterface {
  name = 'AddClassificationConfidence1781772970268';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "requests" ADD COLUMN "classification_confidence" numeric(3,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "requests" ADD CONSTRAINT "chk_classification_confidence_range" CHECK (classification_confidence IS NULL OR (classification_confidence >= 0 AND classification_confidence <= 1))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_requests_type" ON "requests" ("request_type")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_requests_type"`);
    await queryRunner.query(`ALTER TABLE "requests" DROP COLUMN "classification_confidence"`);
  }
}
