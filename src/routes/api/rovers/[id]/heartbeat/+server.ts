import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { rovers } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * PATCH /api/rovers/[id]/heartbeat
 * Update the lastHeartbeat timestamp for a rover
 */
export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = Number(params.id);
	if (!id) {
		return new Response(JSON.stringify({ error: 'Invalid rover ID' }), { status: 400 });
	}

	try {
		const body = await request.json();
		const { timestamp } = body;

		if (!timestamp) {
			return new Response(JSON.stringify({ error: 'Timestamp is required' }), { status: 400 });
		}

		// Convert timestamp to Date if it's a number
		const heartbeatDate = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);

		// Update the rover's lastHeartbeat
		const result = await db
			.update(rovers)
			.set({ lastHeartbeat: heartbeatDate })
			.where(eq(rovers.id, id))
			.returning();

		if (!result[0]) {
			return new Response(JSON.stringify({ error: 'Rover not found' }), { status: 404 });
		}

		return new Response(
			JSON.stringify({
				message: 'Heartbeat updated successfully',
				lastHeartbeat: result[0].lastHeartbeat
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (err) {
		console.error('Error updating rover heartbeat:', err);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
};
