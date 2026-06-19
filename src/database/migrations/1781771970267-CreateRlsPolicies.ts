import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRlsPolicies1781771970267 implements MigrationInterface {
  name = 'CreateRlsPolicies1781771970267';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const orgIdTables = ['users', 'requests', 'quotes', 'pricing_rules', 'skus', 'audit_events'];

    for (const table of orgIdTables) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);

      await queryRunner.query(`
        DO $$ BEGIN
          CREATE POLICY select_by_org ON "${table}" FOR SELECT
            USING (org_id = current_setting('app.org_id')::uuid);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);

      await queryRunner.query(`
        DO $$ BEGIN
          CREATE POLICY insert_by_org ON "${table}" FOR INSERT
            WITH CHECK (org_id = current_setting('app.org_id')::uuid);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);

      await queryRunner.query(`
        DO $$ BEGIN
          CREATE POLICY update_by_org ON "${table}" FOR UPDATE
            USING (org_id = current_setting('app.org_id')::uuid)
            WITH CHECK (org_id = current_setting('app.org_id')::uuid);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);

      await queryRunner.query(`
        DO $$ BEGIN
          CREATE POLICY delete_by_org ON "${table}" FOR DELETE
            USING (org_id = current_setting('app.org_id')::uuid);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const orgIdTables = ['users', 'requests', 'quotes', 'pricing_rules', 'skus', 'audit_events'];

    for (const table of orgIdTables) {
      await queryRunner.query(`DROP POLICY IF EXISTS select_by_org ON "${table}"`);
      await queryRunner.query(`DROP POLICY IF EXISTS insert_by_org ON "${table}"`);
      await queryRunner.query(`DROP POLICY IF EXISTS update_by_org ON "${table}"`);
      await queryRunner.query(`DROP POLICY IF EXISTS delete_by_org ON "${table}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }
  }
}
