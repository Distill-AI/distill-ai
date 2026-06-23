import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed the demo organization (US-E1-1).
 *
 * In demo mode (`AUTH_ENABLED=false`) the RLS middleware sets `app.org_id` to the nil UUID, so every
 * request/attachment is scoped to that org. The `requests.org_id` FK means inserts fail unless an
 * organization row with that id exists. This seeds it idempotently so the ingestion endpoint works
 * out of the box; production rows come from real orgs and are unaffected.
 */
export class SeedDemoOrg1781773970266 implements MigrationInterface {
  name = 'SeedDemoOrg1781773970266';

  private readonly demoOrgId = '00000000-0000-0000-0000-000000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "organizations" ("id", "name", "created_at", "updated_at")
       VALUES ($1, $2, now(), now())
       ON CONFLICT ("id") DO NOTHING`,
      [this.demoOrgId, 'Demo Org'],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "organizations" WHERE "id" = $1`, [this.demoOrgId]);
  }
}
