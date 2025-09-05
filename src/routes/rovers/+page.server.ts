import { redirect } from '@sveltejs/kit';
import type { ServerLoad } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { rovers } from '$lib/server/db/schema';


export const load: ServerLoad = async (event) => {
    if (!event.locals.user) {
        return redirect(302, '/login');
    }

    const roversData = await db.select().from(rovers);
    return { roversData };
};