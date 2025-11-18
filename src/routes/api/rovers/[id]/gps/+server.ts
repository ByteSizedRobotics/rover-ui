import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { logs } from '$lib/server/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const roverId = params.id;

	if (!roverId) {
		return new Response(JSON.stringify({ error: 'Rover ID is required' }), { status: 400 });
	}

	try {
		// Fetch the latest log entry for this rover to get GPS coordinates
		// Use PostGIS functions to extract lat/lng from the geometry point
		const latestLog = await db
			.select({
				latitude: sql<number>`ST_Y(${logs.location})`,
				longitude: sql<number>`ST_X(${logs.location})`,
				altitude: logs.altitude,
				timestamp: logs.timestamp
			})
			.from(logs)
			.where(eq(logs.roverId, Number(roverId)))
			.orderBy(desc(logs.timestamp))
			.limit(1);

		if (!latestLog || latestLog.length === 0) {
			// console.log(`[GPS API] Rover ${roverId} - No GPS data available in database`);
			return new Response(
				JSON.stringify({ 
					error: 'No GPS data available',
					latitude: 0,
					longitude: 0,
					altitude: 0
				}),
				{ 
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		const gpsData = latestLog[0];
		// console.log(`[GPS API] Rover ${roverId} - Latest GPS from DB:`, gpsData);

		return new Response(
			JSON.stringify({
				latitude: gpsData.latitude,
				longitude: gpsData.longitude,
				altitude: gpsData.altitude,
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (err) {
		console.error('Error fetching GPS data:', err);
		return new Response(
			JSON.stringify({ 
				error: 'Internal Server Error',
				latitude: 0,
				longitude: 0,
				altitude: 0
			}),
			{ status: 500 }
		);
	}
};
