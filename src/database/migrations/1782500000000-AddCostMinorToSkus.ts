import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds skus.cost_minor so the policy node can evaluate a true gross margin
 * (US-E4-2 FR-1). The 70%-of-base (30% margin) backfill is scoped to the seeded
 * demo org only, so seeded catalogs have a cost basis to price against without
 * inventing a synthetic margin for any real org's SKUs - those keep cost_minor
 * NULL until a real cost is set.
 */
const SEED_ORG_ID = '00000000-0000-0000-0000-000000000000';

export class AddCostMinorToSkus1782500000000 implements MigrationInterface {
  name = 'AddCostMinorToSkus1782500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "skus" ADD COLUMN IF NOT EXISTS "cost_minor" integer`);
    await queryRunner.query(
      `UPDATE "skus" SET "cost_minor" = round("base_price_minor" * 0.7)
         WHERE "cost_minor" IS NULL AND "org_id" = $1`,
      [SEED_ORG_ID],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "skus" DROP COLUMN IF EXISTS "cost_minor"`);
  }
}
