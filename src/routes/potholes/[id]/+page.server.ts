import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { images, detections } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (isNaN(id)) throw error(400, 'Invalid image ID');

	try {
		const imgRes = await db.select().from(images).where(eq(images.id, id)).limit(1);
		if (imgRes.length === 0) throw error(404, 'Image not found');
		const image = imgRes[0];

		const dets = await db
			.select({
				id: detections.id,
				bbox: detections.bbox,
				confidence: detections.confidence,
				areaScore: detections.areaScore,
				depthScore: detections.depthScore,
				falsePositive: detections.falsePositive
			})
			.from(detections)
			.where(eq(detections.imageId, id))
			.orderBy(desc(detections.id));

		return { image, detections: dets };
	} catch (err) {
		console.error('Error loading pothole page:', err);
		throw error(500, 'Failed to load pothole details');
	}
};
