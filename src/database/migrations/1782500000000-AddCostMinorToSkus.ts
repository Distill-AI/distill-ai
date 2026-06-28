import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds skus.cost_minor so the policy node can evaluate a true gross margin
 * (US-E4-2 FR-1). Backfills existing demo SKUs at 70% of base price (a 30%
 * baseline margin) so seeded catalogs have a cost basis to price against.
 */
export class AddCostMinorToSkus1782500000000 implements MigrationInterface {
  name = 'AddCostMinorToSkus1782500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "skus" ADD COLUMN IF NOT EXISTS "cost_minor" integer`);
    await queryRunner.query(
      `UPDATE "skus" SET "cost_minor" = round("base_price_minor" * 0.7) WHERE "cost_minor" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "skus" DROP COLUMN IF EXISTS "cost_minor"`);
  }
}
