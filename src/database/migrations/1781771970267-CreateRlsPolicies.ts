import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRlsPolicies1781771970267 implements MigrationInterface {
  name = 'CreateRlsPolicies1781771970267';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const orgIdTables = ['users', 'requests', 'quotes', 'pricing_rules', 'skus', 'audit_events'];

    // Validate all tables have org_id column
    for (const table of orgIdTables) {
      const result = await queryRunner.query(
        `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'org_id'
      `,
        [table],
      );
      if (result.length === 0) {
        throw new Error(`Table "${table}" missing required org_id column for RLS`);
      }
      if (result[0].data_type !== 'uuid') {
        throw new Error(`Table "${table}" org_id column must be uuid, got ${result[0].data_type}`);
      }
    }

    for (const table of orgIdTables) {
      await queryRunner.query(`
        ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;
        ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;
      `);

      await queryRunner.query(`
        DO $$ BEGIN
          CREATE POLICY select_by_org ON "${table}" FOR SELECT
            USING (org_id = current_setting('app.org_id', true)::uuid);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);

      await queryRunner.query(`
        DO $$ BEGIN
          CREATE POLICY insert_by_org ON "${table}" FOR INSERT
            WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);

      await queryRunner.query(`
        DO $$ BEGIN
          CREATE POLICY update_by_org ON "${table}" FOR UPDATE
            USING (org_id = current_setting('app.org_id', true)::uuid)
            WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);

      await queryRunner.query(`
        DO $$ BEGIN
          CREATE POLICY delete_by_org ON "${table}" FOR DELETE
            USING (org_id = current_setting('app.org_id', true)::uuid);
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
      await queryRunner.query(`ALTER TABLE "${table}" NO FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }
  }
}
