import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { rovers } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';


export const POST: RequestHandler = async ({ params }) => {
    const roverId = params.id;

    if (!roverId) {
        return new Response(JSON.stringify({ error: 'Rover ID is required' }), { status: 400 });
    }

    try {
        const rover = await db.select().from(rovers).where(eq(rovers.id, Number(roverId))).limit(1);
        if (rover.length === 0) {
            return new Response(JSON.stringify({ error: 'Rover not found' }), { status: 404 });
        }

        await db.update(rovers).set({ lastHeartbeat: new Date() }).where(eq(rovers.id, Number(roverId)));

        // Fetch the updated heartbeat only
        const updatedRover = await db.select({ id: rovers.id, lastHeartbeat: rovers.lastHeartbeat })
            .from(rovers)
            .where(eq(rovers.id, Number(roverId)))
            .limit(1);

        return new Response(JSON.stringify(updatedRover[0]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        console.error('Error updating rover heartbeat:', err);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
};
