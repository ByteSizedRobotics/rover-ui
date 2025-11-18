import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { paths } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * GET /api/rovers/:id/latest-path
 * Returns the latest path ID for a given rover
 */
export const GET: RequestHandler = async ({ params }) => {
	const roverId = Number(params.id);
	
	if (!roverId || isNaN(roverId)) {
		return new Response(JSON.stringify({ error: 'Invalid rover ID' }), { 
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		// Get the most recent path for this rover
		const latestPath = await db
			.select({ id: paths.id, timestamp: paths.timestamp })
			.from(paths)
			.where(eq(paths.roverId, roverId))
			.orderBy(desc(paths.timestamp))
			.limit(1);
			
		if (latestPath.length === 0) {
			return new Response(JSON.stringify({ path_id: null, message: 'No paths found for this rover' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response(JSON.stringify({ 
			path_id: latestPath[0].id,
			timestamp: latestPath[0].timestamp
		}), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('Error fetching latest path:', err);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
