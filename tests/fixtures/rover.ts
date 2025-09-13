import { db } from '../vitest.setup';
import { rovers } from '$lib/server/db/schema';

export const createRoverFixture = async (name: string = 'Test Rover', ipAddress: string = '127.0.0.1') => {
    const result = await db.insert(rovers).values({
        name,
        ipAddress,
    }).returning();

    return result[0];
}