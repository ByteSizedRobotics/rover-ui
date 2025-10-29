import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { rovers } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	if (!id) {
		return new Response(JSON.stringify({ error: 'Invalid rover ID' }), { status: 400 });
	}

	try {
		const rover = await db.select().from(rovers).where(eq(rovers.id, id)).limit(1);
		if (rover.length === 0) {
			return new Response(JSON.stringify({ error: 'Rover not found' }), { status: 404 });
		}

		return new Response(JSON.stringify(rover[0]), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('Error fetching rover:', err);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	if (!id) {
		return new Response(JSON.stringify({ error: 'Invalid rover ID' }), { status: 400 });
	}

	try {
		const result = await db.delete(rovers).where(eq(rovers.id, id)).returning();
		if (!result[0]) {
			return new Response(JSON.stringify({ error: 'Rover not found' }), { status: 404 });
		}

		return new Response(JSON.stringify({ message: 'Rover deleted successfully' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('Error deleting rover:', err);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
};
