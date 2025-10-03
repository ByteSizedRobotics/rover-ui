import { db } from '../vitest.setup';
import { rovers } from '$lib/server/db/schema';

export const createRoverFixture = async (
	name: string = 'Test Rover',
	lastHeartbeat: Date = new Date(),
	ipAddress: string = '127.0.0.1'
) => {
	const result = await db
		.insert(rovers)
		.values({
			name,
			lastHeartbeat,
			ipAddress
		})
		.returning();

	return result[0];
};
