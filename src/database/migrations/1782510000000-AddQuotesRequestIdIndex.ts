import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes quotes.request_id. QuoteModelAction.replaceForRequest / deleteForRequest look a quote up
 * by request_id on every price-node run; without this index that lookup is a sequential scan once
 * the table grows beyond the one-quote-per-request volume it starts at.
 */
export class AddQuotesRequestIdIndex1782510000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS quotes_request_id_idx ON quotes (request_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS quotes_request_id_idx`);
  }
}
