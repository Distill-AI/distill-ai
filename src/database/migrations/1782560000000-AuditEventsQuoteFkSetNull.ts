import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `quote_recompute` replaces a request's quote on every re-map (delete + re-insert), but
 * `audit_events.quote_id` referenced `quotes(id)` with ON DELETE NO ACTION, so any request whose
 * quote already had an audit event (e.g. pricing.completed) failed the re-map PATCH with a foreign
 * key violation. `quote_id` is a soft link (the event's own `attributes` snapshot the values at the
 * time it fired), so ON DELETE SET NULL is the correct action: replacing the quote nulls the link
 * on historical events instead of blocking the delete.
 */
export class AuditEventsQuoteFkSetNull1782560000000 implements MigrationInterface {
  name = 'AuditEventsQuoteFkSetNull1782560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT IF EXISTS "FK_6b55fa9432fdde66709f8cf3c43"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "FK_6b55fa9432fdde66709f8cf3c43" ` +
        `FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT IF EXISTS "FK_6b55fa9432fdde66709f8cf3c43"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "FK_6b55fa9432fdde66709f8cf3c43" ` +
        `FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
