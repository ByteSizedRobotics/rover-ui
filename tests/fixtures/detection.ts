import { db } from '../vitest.setup';
import { detections } from '$lib/server/db/schema';
import { createImageFixture } from './image';

export const createDetectionFixture = async (
    imageId?: number,
    confidence: number = 0.9,
    bbox: [number, number, number, number] = [0, 0, 10, 10],
    areaScore: number | null = null,
    depthScore: number | null = null,
    falsePositive: number | null = null
) => {
    if (!imageId) {
        const image = await createImageFixture();
        imageId = image.id;
    }

    const result = await db.insert(detections).values({
        imageId,
        confidence,
        bbox,
        areaScore,
        depthScore,
        falsePositive
    }).returning();

    return result[0];
};