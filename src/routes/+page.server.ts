import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { rovers } from '$lib/server/db/schema';


export const load: PageServerLoad = async (event) => {
    if (!event.locals.user) {
        return redirect(302, '/login');
    }

    const roversData = await db.select().from(rovers);
    return { roversData };
};