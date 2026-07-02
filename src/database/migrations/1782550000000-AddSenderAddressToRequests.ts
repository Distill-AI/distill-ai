import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSenderAddressToRequests1782550000000 implements MigrationInterface {
  name = 'AddSenderAddressToRequests1782550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "sender_address" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "requests" DROP COLUMN IF EXISTS "sender_address"`);
  }
}
