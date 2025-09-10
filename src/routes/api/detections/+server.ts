import { db } from '$lib/server/db';
import { detections } from '$lib/server/db/schema';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
    const { image_id, confidence, bbox } = await request.json();

    if (!image_id || typeof confidence !== 'number' || !Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(n => Number.isInteger(n))) {
        return new Response(JSON.stringify({ error: 'Missing or invalid parameters' }), { status: 400 });
    }

    const result = await db
        .insert(detections)
        .values({
            imageId: image_id,
            confidence,
            bbox: `(${bbox.join(',')})`
        })
        .returning();

    const detection_id = result[0]?.id;

    return new Response(JSON.stringify({ detection_id }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
    });
};