import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMatchingIndexes1782375190737 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Idempotent guards: both extensions may already be installed by prior migrations.
    // Including them here keeps this migration self-sufficient if run in isolation.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS skus_name_desc_trgm_idx
        ON skus USING gin ((name || ' ' || COALESCE(description, '')) gin_trgm_ops)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS skus_embedding_hnsw_idx
        ON skus USING hnsw (embedding vector_cosine_ops)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS candidate_matches_line_item_id_idx
        ON candidate_matches (line_item_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Drop only the indexes this migration owns.
    // Extensions are not dropped: they may have been installed by prior migrations
    // and other objects could depend on them.
    await queryRunner.query(`DROP INDEX IF EXISTS candidate_matches_line_item_id_idx`);
    await queryRunner.query(`DROP INDEX IF EXISTS skus_embedding_hnsw_idx`);
    await queryRunner.query(`DROP INDEX IF EXISTS skus_name_desc_trgm_idx`);
  }
}
