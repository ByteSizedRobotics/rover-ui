import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { detections, images, paths, rovers } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
	const detectionId = Number(params.id);

	if (isNaN(detectionId)) {
		throw error(400, 'Invalid detection ID');
	}

	try {
		// Join detection with image, path, and rover data, extracting lat/lon in the same query
		const result = await db
			.select({
				detectionId: detections.id,
				detectionBbox: detections.bbox,
				detectionConfidence: detections.confidence,
				detectionAreaScore: detections.areaScore,
				detectionDepthScore: detections.depthScore,
				detectionFalsePositive: detections.falsePositive,
				imageId: images.id,
				imageUrl: images.imageUrl,
				imageTimestamp: images.timestamp,
				imageLat: sql<number>`ST_Y(${images.location}::geometry)`,
				imageLon: sql<number>`ST_X(${images.location}::geometry)`,
				pathId: paths.id,
				pathTimestamp: paths.timestamp,
				roverId: rovers.id,
				roverName: rovers.name,
				roverIpAddress: rovers.ipAddress
			})
			.from(detections)
			.innerJoin(images, eq(detections.imageId, images.id))
			.innerJoin(paths, eq(images.pathId, paths.id))
			.innerJoin(rovers, eq(paths.roverId, rovers.id))
			.where(eq(detections.id, detectionId))
			.limit(1);

		if (result.length === 0) {
			throw error(404, 'Detection not found');
		}

		const data = result[0];

		return {
			detection: {
				id: data.detectionId,
				bbox: data.detectionBbox as number[],
				confidence: data.detectionConfidence,
				areaScore: data.detectionAreaScore,
				depthScore: data.detectionDepthScore,
				falsePositive: data.detectionFalsePositive
			},
			image: {
				id: data.imageId,
				imageUrl: data.imageUrl,
				timestamp: data.imageTimestamp,
				location: [data.imageLat, data.imageLon]
			},
			path: {
				id: data.pathId,
				timestamp: data.pathTimestamp
			},
			rover: {
				id: data.roverId,
				name: data.roverName,
				ipAddress: data.roverIpAddress
			}
		};
	} catch (err) {
		console.error('Error fetching detection details:', err);
		throw error(500, 'Failed to fetch detection details');
	}
};
