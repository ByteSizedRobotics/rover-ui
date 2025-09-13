import { db } from '../vitest.setup';
import { images } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';
import { createPathFixture } from './path';

import type { SQL } from 'drizzle-orm';

export const createImageFixture = async (
	pathId?: number,
	imageUrl: string = 'uploads/test.jpg',
	timestamp: Date = new Date(),
	location: SQL = sql`ST_SetSRID(ST_MakePoint(0, 0), 4326)`
) => {
	if (!pathId) {
		// If no pathId is provided, create a new path fixture
		const path = (await createPathFixture()) as { id: number };
		pathId = path.id;
	}

	const result = await db
		.insert(images)
		.values({
			pathId,
			imageUrl,
			timestamp,
			location
		})
		.returning();

	return result[0];
};
