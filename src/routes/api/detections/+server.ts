import { db } from '$lib/server/db';
import { detections } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const imageId = url.searchParams.get('imageId');
		
		let allDetections;
		if (imageId) {
			// Filter by imageId if provided
			allDetections = await db
				.select()
				.from(detections)
				.where(eq(detections.imageId, parseInt(imageId)))
				.orderBy(desc(detections.id));
		} else {
			// Otherwise return all detections
			allDetections = await db.select().from(detections).orderBy(desc(detections.id));
		}

		return new Response(JSON.stringify(allDetections), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('Error fetching detections:', err);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	const { image_id, confidence, bbox } = await request.json();

	if (
		!image_id ||
		typeof confidence !== 'number' ||
		!Array.isArray(bbox) ||
		bbox.length !== 4 ||
		!bbox.every((n) => Number.isInteger(n))
	) {
		return new Response(JSON.stringify({ error: 'Missing or invalid parameters' }), {
			status: 400
		});
	}

	try {
		const result = await db
			.insert(detections)
			.values({
				imageId: image_id,
				confidence,
				bbox: bbox // Store as JSON array, not string
			})
			.returning();

		const detection_id = result[0]?.id;
		if (!detection_id) {
			throw new Error('Failed to retrieve inserted detection ID');
		}

		return new Response(JSON.stringify({ detection_id }), {
			status: 201,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('Error creating detection:', err);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
};
