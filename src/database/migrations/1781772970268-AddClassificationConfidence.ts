import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClassificationConfidence1781772970268 implements MigrationInterface {
  name = 'AddClassificationConfidence1781772970268';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "classification_confidence" numeric(3,2)`,
    );
    // EXCEPTION is only valid inside a PL/pgSQL block, so the ADD CONSTRAINT must be wrapped in
    // DO $$ ... END $$ (a bare statement with a trailing EXCEPTION clause is a syntax error).
    await queryRunner.query(
      `DO $$ BEGIN
        ALTER TABLE "requests" ADD CONSTRAINT "chk_classification_confidence_range"
          CHECK (classification_confidence IS NULL OR (classification_confidence >= 0 AND classification_confidence <= 1));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_requests_type_1781772970268" ON "requests" ("request_type")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_requests_type_1781772970268"`);
    await queryRunner.query(`ALTER TABLE "requests" DROP COLUMN "classification_confidence"`);
  }
}
