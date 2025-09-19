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


export const POST: RequestHandler = async ({ request }) => {
    try {
        const { rover_id, routeWKT } = await request.json();

        if (!rover_id || !routeWKT) {
            return new Response(JSON.stringify({ error: 'rover_id and routeWKT are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const result = await db.execute(`
            INSERT INTO paths ("rover_id", route)
            VALUES (${rover_id}, ST_GeomFromText('${routeWKT}', 4326))
            RETURNING id, rover_id, timestamp, ST_AsGeoJSON(route) AS route;
        `);

        const newPath = result[0];
        if (typeof newPath.route === 'string') {
            newPath.route = JSON.parse(newPath.route);
        }

        return new Response(JSON.stringify(newPath), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error creating path:', error);
        return new Response(JSON.stringify({ error: 'Failed to create path' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
