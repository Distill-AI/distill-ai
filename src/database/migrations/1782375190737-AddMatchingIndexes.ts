import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMatchingIndexes1782375190737 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

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
    await queryRunner.query(`DROP INDEX IF EXISTS candidate_matches_line_item_id_idx`);
    await queryRunner.query(`DROP INDEX IF EXISTS skus_embedding_hnsw_idx`);
    await queryRunner.query(`DROP INDEX IF EXISTS skus_name_desc_trgm_idx`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS pg_trgm`);
  }
}
