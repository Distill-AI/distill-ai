import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLineItemMatchRoutingReason1782396024040 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE line_items
        ADD COLUMN IF NOT EXISTS match_routing_reason text
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE line_items
        DROP COLUMN IF EXISTS match_routing_reason
    `);
  }
}
