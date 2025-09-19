import { db } from '$lib/server/db';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
    try {
        // Query the database and convert the 'route' geometry to GeoJSON
        const result = await db.execute(
            `SELECT id, rover_id, timestamp, ST_AsGeoJSON(route) AS route FROM paths ORDER BY id DESC`
        );
        // Parse the GeoJSON string for each row
        const allPaths = result.map((row: any) => ({
            ...row,
            route: JSON.parse(row.route)
        }));

        return new Response(JSON.stringify(allPaths), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error fetching paths:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch paths' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
