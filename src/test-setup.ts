import * as dotenv from 'dotenv';

dotenv.config();

function envDefault(key: string, fallback: string): string {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  return raw.trim();
}

process.env.DATABASE_HOST = envDefault('DATABASE_HOST', 'localhost');
process.env.DATABASE_USER = envDefault('DATABASE_USER', 'test');
process.env.DATABASE_PASSWORD = envDefault('DATABASE_PASSWORD', 'test');
process.env.DATABASE_NAME = envDefault('DATABASE_NAME', 'test');
process.env.OBJECT_STORE_URL = envDefault('OBJECT_STORE_URL', 'file://./var/object-store');
