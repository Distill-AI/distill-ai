import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a UNIQUE index on quotes.request_id. QuoteModelAction treats request_id as a replace key -
 * replaceForRequest deletes any prior quote for the request before inserting - so at most one quote
 * may exist per request. A unique index both speeds the by-request lookup on every price-node run
 * (otherwise a sequential scan as the table grows) and enforces that invariant at the database level,
 * so two concurrent replaceForRequest calls cannot leave duplicate quotes behind.
 *
 * Any duplicate request_id rows left from the pre-constraint window are collapsed first - keeping the
 * most recently created quote per request and dropping the rest (with their line items) - so the
 * index creation is deterministic on upgrade instead of failing on legacy data.
 */
export class AddQuotesRequestIdIndex1782510000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Rank quotes per request (newest kept), then delete the older duplicates and their line items.
    const duplicates = `
      SELECT id FROM (
        SELECT id, row_number() OVER (
          PARTITION BY request_id ORDER BY created_at DESC, id DESC
        ) AS rn
        FROM quotes
      ) ranked WHERE rn > 1
    `;
    await queryRunner.query(`DELETE FROM quote_line_items WHERE quote_id IN (${duplicates})`);
    await queryRunner.query(`DELETE FROM quotes WHERE id IN (${duplicates})`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS quotes_request_id_uidx ON quotes (request_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS quotes_request_id_uidx`);
  }
}
