import * as dotenv from 'dotenv';

dotenv.config();

process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_USER = process.env.DATABASE_USER ?? 'test';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'test';
process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'test';
process.env.OBJECT_STORE_URL = process.env.OBJECT_STORE_URL?.trim() || 'file://./var/object-store';
