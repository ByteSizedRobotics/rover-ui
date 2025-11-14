import { db } from '$lib/server/db';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	if (!id) {
		return new Response(JSON.stringify({ error: 'Invalid path ID' }), { status: 400 });
	}

	try {
		const result = await db.execute(
			`SELECT id, rover_id, timestamp, ST_AsGeoJSON(route) AS route FROM paths WHERE id = ${id} LIMIT 1`
		);
		if (result.length === 0) {
			return new Response(JSON.stringify({ error: 'Path not found' }), { status: 404 });
		}

		const path = result[0];
		if (typeof path.route === 'string') {
			path.route = JSON.parse(path.route);
		}

		// Fetch all logs associated with this path
		const logsResult = await db.execute(
			`SELECT id, rover_id, timestamp, ST_AsGeoJSON(location) AS location, altitude, roll, pitch, yaw, temperature, voltage FROM logs WHERE path_id = ${id} ORDER BY timestamp ASC`
		);
		
		const logs = logsResult.map((log: any) => {
			if (typeof log.location === 'string') {
				log.location = JSON.parse(log.location);
			}
			return log;
		});

		return new Response(JSON.stringify({ ...path, logs }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Error fetching path:', error);
		return new Response(JSON.stringify({ error: 'Failed to fetch path' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	if (!id) {
		return new Response(JSON.stringify({ error: 'Invalid path ID' }), { status: 400 });
	}

	try {
		const result = await db.execute(`DELETE FROM paths WHERE id = ${id} RETURNING id`);
		if (result.length === 0) {
			return new Response(JSON.stringify({ error: 'Path not found' }), { status: 404 });
		}

		return new Response(null, { status: 204 });
	} catch (error) {
		console.error('Error deleting path:', error);
		return new Response(JSON.stringify({ error: 'Failed to delete path' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
