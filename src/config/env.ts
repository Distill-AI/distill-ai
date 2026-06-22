import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const boolEnv = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true');

const envSchema = z.object({
  // ── Core ─────────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // ── Database ─────────────────────────────────────────────────────────────
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.coerce.number().int().positive().default(5432),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string(),
  DATABASE_NAME: z.string().min(1),
  DATABASE_SYNC: boolEnv.default(false),
  DATABASE_LOGGING: boolEnv.default(false),
  DATABASE_SSL: boolEnv.default(false),

  // ── Redis ─────────────────────────────────────────────────────────────────
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_USERNAME: z.string().optional(),
  REDIS_TLS: boolEnv.default(false),

  // ── Logging ───────────────────────────────────────────────────────────────
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // ── API ───────────────────────────────────────────────────────────────────
  SWAGGER_ENABLED: boolEnv.default(true),
  CORS_ORIGIN: z.string().default('*'),

  // ── Reference feature: Bull queue worker (remove if not using queues) ─────
  QUEUE_CONCURRENCY: z.coerce
    .number()
    .int()
    .default(3)
    .transform((v) => Math.max(1, v)),
  LEASE_TTL_SECONDS: z.coerce.number().int().positive().default(60),

  // ── Pipeline (US-E8-4) ────────────────────────────────────────────────────
  PIPELINE_CONCURRENCY: z.coerce
    .number()
    .int()
    .default(3)
    .transform((v) => Math.max(1, v)),
  SWEEP_STALE_SECONDS: z.coerce
    .number()
    .int()
    .default(60)
    .transform((v) => Math.max(1, v)),

  // ── Reference feature: DLQ alert email (remove if not using DLQ) ─────────
  DLQ_ALERT_THRESHOLD: z.coerce.number().int().positive().default(10),
  ALERT_EMAIL: z.string().email().default('admin@example.com'),
  EMAIL_FROM: z.string().default('App <noreply@example.com>'),

  // ── Object storage (US-E1-1-T2) ───────────────────────────────────────────
  // Bare path or file:// URL for the local adapter; other schemes are rejected at boot for now.
  OBJECT_STORE_URL: z.string().min(1).default('file://./var/object-store'),

  // ── Observability ─────────────────────────────────────────────────────────
  SENTRY_DSN: z.string().url().optional(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment variables:\n', result.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = result.data;
export type Env = typeof env;
