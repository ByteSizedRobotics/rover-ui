import type { PageServerLoad } from "./$types";
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { rovers } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ params }) => {
    const id = params.id;

    if (id) {
        const rover = await db.select({
            name: rovers.name,
          }).from(rovers).where(eq(rovers.id, id));
        
        if (rover.length > 0) {
            return { name: rover[0].name };
        }
    }

    return { name: null };
};