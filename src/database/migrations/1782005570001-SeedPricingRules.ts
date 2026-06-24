import { MigrationInterface, QueryRunner } from 'typeorm';

const ORG_ID = '00000000-0000-0000-0000-000000000000';

const RULES: Array<[string, string, Record<string, unknown>]> = [
  ['d0000000-0000-0000-0000-000000000001', 'margin_floor', { min_margin_pct: 15 }],
  ['d0000000-0000-0000-0000-000000000002', 'max_discount', { max_discount_pct: 20 }],
  ['d0000000-0000-0000-0000-000000000003', 'qty_break', { min_qty: 50, discount_pct: 5 }],
  ['d0000000-0000-0000-0000-000000000004', 'qty_break', { min_qty: 200, discount_pct: 10 }],
  ['d0000000-0000-0000-0000-000000000005', 'qty_break', { min_qty: 1000, discount_pct: 15 }],
  [
    'd0000000-0000-0000-0000-000000000006',
    'lead_time',
    { express_days: 5, premium_pct: 25, priority_days: 3, priority_premium_pct: 40 },
  ],
];

export class SeedPricingRules1782005570001 implements MigrationInterface {
  name = 'SeedPricingRules1782005570001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [id, rule_type, config] of RULES) {
      await queryRunner.query(
        `INSERT INTO "pricing_rules" ("id","org_id","rule_type","config","active","created_at","updated_at")
         VALUES ($1,$2,$3,$4::jsonb,true,now(),now())
         ON CONFLICT (id) DO NOTHING`,
        [id, ORG_ID, rule_type, JSON.stringify(config)],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const ids = RULES.map(([id]) => id);
    await queryRunner.query(`DELETE FROM "pricing_rules" WHERE "id" = ANY($1::uuid[])`, [ids]);
  }
}
