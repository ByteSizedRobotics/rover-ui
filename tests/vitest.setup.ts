import { config } from 'dotenv';
import { afterAll, afterEach, beforeAll } from 'vitest';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

export let pool: pg.Pool;
export let db: ReturnType<typeof drizzle>;

if (!process.env.CI) {
	config({ path: '.env.test', quiet: true });
}

beforeAll(async () => {
	pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
	db = drizzle(pool); // ✅ assign to exported variable
	await migrate(db, { migrationsFolder: 'drizzle/' });
});

afterEach(async () => {
	await pool.query('TRUNCATE detections, images, rovers RESTART IDENTITY CASCADE');
});

afterAll(async () => {
	if (pool) await pool.end();
});
