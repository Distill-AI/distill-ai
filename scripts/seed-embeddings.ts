import 'reflect-metadata';
import OpenAI from 'openai';
import { DataSource } from 'typeorm';

import { env } from '../src/config/env';

const BATCH_SIZE = 10;

async function embed(client: OpenAI, texts: string[]): Promise<number[][]> {
  const res = await client.embeddings.create({ model: env.EMBEDDINGS_MODEL, input: texts });
  return res.data.map((d) => d.embedding);
}

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

  const client = new OpenAI({
    apiKey: env.LLM_API_KEY,
    baseURL: env.LLM_BASE_URL,
  });

  const skus: Array<{ id: string; name: string; description: string | null }> = await ds.query(
    `SELECT id, name, description FROM skus WHERE embedding IS NULL`,
  );

  console.log(`Populating embeddings for ${skus.length} SKUs in batches of ${BATCH_SIZE}`);

  for (let i = 0; i < skus.length; i += BATCH_SIZE) {
    const batch = skus.slice(i, i + BATCH_SIZE);
    const texts = batch.map((s) => `${s.name}${s.description ? '. ' + s.description : ''}`);
    const vectors = await embed(client, texts);

    if (vectors.length !== batch.length) {
      throw new Error(`Expected ${batch.length} embeddings, got ${vectors.length}`);
    }

    for (let j = 0; j < batch.length; j++) {
      await ds.query(`UPDATE skus SET embedding = $1::vector, updated_at = now() WHERE id = $2`, [
        `[${vectors[j].join(',')}]`,
        batch[j].id,
      ]);
    }
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} done (${i + batch.length}/${skus.length})`);
  }

  await ds.destroy();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
