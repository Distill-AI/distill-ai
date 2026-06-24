import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditEventsAppendOnlyAndStageErrorDedup1782281287487 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        DROP POLICY IF EXISTS update_by_org ON "audit_events";
        DROP POLICY IF EXISTS delete_by_org ON "audit_events";
      END $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS audit_events_stage_error_dedup_idx
        ON audit_events (
          request_id,
          event_name,
          ((attributes->>'stage')),
          ((attributes->>'reason')),
          ((created_at AT TIME ZONE 'UTC')::date)
        )
        WHERE event_name = 'stage.error'
          AND request_id IS NOT NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS audit_events_stage_error_dedup_idx;`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE POLICY delete_by_org ON "audit_events" FOR DELETE
          USING (org_id = current_setting('app.org_id', true)::uuid);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE POLICY update_by_org ON "audit_events" FOR UPDATE
          USING (org_id = current_setting('app.org_id', true)::uuid)
          WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }
}
