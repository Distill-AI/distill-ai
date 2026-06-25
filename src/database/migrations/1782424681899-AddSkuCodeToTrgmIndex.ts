import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSkuCodeToTrgmIndex1782424681899 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS skus_name_desc_trgm_idx`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS skus_name_desc_sku_code_trgm_idx
        ON skus USING gin (
          (COALESCE(sku_code, '') || ' ' || COALESCE(name, '') || ' ' || COALESCE(description, ''))
          gin_trgm_ops
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS skus_name_desc_sku_code_trgm_idx`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS skus_name_desc_trgm_idx
        ON skus USING gin ((name || ' ' || COALESCE(description, '')) gin_trgm_ops)
    `);
  }
}
