import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { rovers } from '$lib/server/db/schema';


export const GET: RequestHandler = async () => {
    try {
        // Fetch all rovers from the database
        const allRovers = await db.select().from(rovers);
        return new Response(JSON.stringify({ roversData: allRovers }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        console.error('Error fetching rovers:', err);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
};


export const POST: RequestHandler = async ({ request }) => {
    try {
        const { name, ipAddress } = await request.json();

        if (!name || !ipAddress) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
        }

        // Insert the new rover into the database
        const result = await db.insert(rovers).values({ name, ipAddress }).returning();
        return new Response(JSON.stringify({ rover: result[0] }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        console.error('Error creating rover:', err);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
};
