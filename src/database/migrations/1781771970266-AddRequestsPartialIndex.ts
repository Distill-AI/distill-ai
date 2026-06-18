import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRequestsPartialIndex1781771970266 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS requests_stale_processing_idx
        ON requests (processing_started_at)
        WHERE status = 'parsing'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS requests_stale_processing_idx`);
  }
}
