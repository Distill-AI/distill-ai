import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a UNIQUE index on quotes.request_id. QuoteModelAction treats request_id as a replace key -
 * replaceForRequest deletes any prior quote for the request before inserting - so at most one quote
 * may exist per request. A unique index both speeds the by-request lookup on every price-node run
 * (otherwise a sequential scan as the table grows) and enforces that invariant at the database level,
 * so two concurrent replaceForRequest calls cannot leave duplicate quotes behind.
 */
export class AddQuotesRequestIdIndex1782510000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS quotes_request_id_uidx ON quotes (request_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS quotes_request_id_uidx`);
  }
}
