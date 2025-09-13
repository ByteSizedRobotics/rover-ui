import { config } from 'dotenv';
import { afterAll, afterEach, beforeAll } from 'vitest';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

let pool: pg.Pool;

config({ path: '.env.test', override: true, quiet: true });

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: 'drizzle/' });
});

afterEach(async () => {
  await pool.query('TRUNCATE detections, images RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  if (pool) await pool.end();
});

export let db: ReturnType<typeof drizzle>;