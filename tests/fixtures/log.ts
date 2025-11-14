import { logs } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';
import { db } from '../vitest.setup';
import { createRoverFixture } from './rover';
import { createPathFixture } from './path';

export const createLogFixture = async (
	roverId?: number,
	pathId?: number,
	latitude: number = 0,
	longitude: number = 0,
	altitude: number = 0,
	roll: number = 0,
	pitch: number = 0,
	yaw: number = 0,
	temperature: number = 20,
	voltage: number = 12.5
) => {
	if (!roverId) {
		const rover = await createRoverFixture();
		roverId = rover.id;
	}
	if (!pathId) {
		const path = await createPathFixture(roverId);
		pathId = path.id;
	}

	const result = await db
		.insert(logs)
		.values({
			roverId,
			pathId,
			location: sql`ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)`,
			altitude,
			roll,
			pitch,
			yaw,
			temperature,
			voltage
		})
		.returning();

	return result[0];
};
