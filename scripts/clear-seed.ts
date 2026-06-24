import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { env } from '../src/config/env';

const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000000';
const MIGRATION_NAMES = ['SeedPricingRules1782005570001', 'SeedSkuCatalog1782005570000'];

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    username: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    entities: [],
    synchronize: false,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
  });

  await ds.initialize();

  const [{ count: ruleCount }]: [{ count: string }] = await ds.query(
    `SELECT COUNT(*) FROM "pricing_rules" WHERE "org_id" = $1`,
    [DEMO_ORG_ID],
  );
  const [{ count: skuCount }]: [{ count: string }] = await ds.query(
    `SELECT COUNT(*) FROM "skus" WHERE "org_id" = $1`,
    [DEMO_ORG_ID],
  );

  await ds.query(`DELETE FROM "pricing_rules" WHERE "org_id" = $1`, [DEMO_ORG_ID]);
  console.log(`Deleted ${ruleCount} pricing rule(s)`);

  await ds.query(`DELETE FROM "skus" WHERE "org_id" = $1`, [DEMO_ORG_ID]);
  console.log(`Deleted ${skuCount} SKU(s)`);

  await ds.query(`DELETE FROM "migrations" WHERE "name" = ANY($1::text[])`, [MIGRATION_NAMES]);
  console.log(`Removed migration records: ${MIGRATION_NAMES.join(', ')}`);

  await ds.destroy();
  console.log('Done. Run pnpm migration:run to reseed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
