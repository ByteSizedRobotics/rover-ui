import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { potholes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
    const id = Number(params.id);
    if (!id) throw error(400, 'Invalid pothole ID');
    const result = await db.select().from(potholes).where(eq(potholes.id, id));
    if (!result || result.length === 0) throw error(404, 'Pothole not found');
    return { pothole: result[0] };
};
