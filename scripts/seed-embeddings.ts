import 'reflect-metadata';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import { DataSource } from 'typeorm';

dotenv.config();

const EMBEDDING_MODEL = process.env.EMBEDDINGS_MODEL ?? 'text-embedding-v4';
const BATCH_SIZE = 20;

async function embed(client: OpenAI, texts: string[]): Promise<number[][]> {
  const res = await client.embeddings.create({ model: EMBEDDING_MODEL, input: texts });
  return res.data.map((d) => d.embedding);
}

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    database: process.env.DATABASE_NAME ?? 'distill',
    entities: [__dirname + '/../src/**/*.entity.{ts,js}'],
    synchronize: false,
  });

  await ds.initialize();

  const client = new OpenAI({
    apiKey: process.env.LLM_API_KEY,
    baseURL: process.env.LLM_BASE_URL,
  });

  const skus: Array<{ id: string; name: string; description: string | null }> = await ds.query(
    `SELECT id, name, description FROM skus WHERE embedding IS NULL`,
  );

  console.log(`Populating embeddings for ${skus.length} SKUs in batches of ${BATCH_SIZE}`);

  for (let i = 0; i < skus.length; i += BATCH_SIZE) {
    const batch = skus.slice(i, i + BATCH_SIZE);
    const texts = batch.map((s) => `${s.name}${s.description ? '. ' + s.description : ''}`);
    const vectors = await embed(client, texts);

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
