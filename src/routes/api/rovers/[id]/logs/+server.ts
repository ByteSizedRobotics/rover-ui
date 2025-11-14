import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { logs, rovers } from '$lib/server/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const roverId = params.id;

	if (!roverId) {
		return new Response(JSON.stringify({ error: 'Rover ID is required' }), { status: 400 });
	}

	try {
		const roverLogs = await db
			.select()
			.from(logs)
			.where(eq(logs.roverId, Number(roverId)))
			.orderBy(desc(logs.timestamp));

		return new Response(JSON.stringify({ logs: roverLogs }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('Error fetching logs:', err);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
};

// Handler to add a new log entry for a specific rover
export const POST: RequestHandler = async ({ request, params }) => {
	const roverId = params.id;

	const { pathId, latitude, longitude, altitude, roll, pitch, yaw, temperature, voltage } =
		await request.json();

	if (!roverId) {
		return new Response(JSON.stringify({ error: 'Rover ID is required' }), { status: 400 });
	}
	if (
		!pathId ||
		!latitude ||
		!longitude ||
		altitude === undefined ||
		roll === undefined ||
		pitch === undefined ||
		yaw === undefined ||
		temperature === undefined ||
		voltage === undefined
	) {
		return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
	}

	// Check if rover exists
	const rover = await db
		.select()
		.from(rovers)
		.where(eq(rovers.id, Number(roverId)))
		.limit(1);
	if (rover.length === 0) {
		return new Response(JSON.stringify({ error: 'Rover not found' }), { status: 404 });
	}

	try {
		const log = await db
			.insert(logs)
			.values({
				roverId: Number(roverId),
				pathId: Number(pathId),
				location: sql`ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)`,
				altitude,
				roll,
				pitch,
				yaw,
				temperature,
				voltage
			})
			.returning();

		return new Response(JSON.stringify({ log: log[0] }), {
			status: 201,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('Error adding log entry:', err);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
};
