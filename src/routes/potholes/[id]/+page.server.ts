import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { images } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
    const id = Number(params.id);
    if (!id) throw error(400, 'Invalid image ID');
    const result = await db.select().from(images).where(eq(images.id, id));
    if (!result || result.length === 0) throw error(404, 'Image not found');
    return { image: result[0] };
};
