import { describe, it, expect } from 'vitest';
import { api } from '../utils/api';
import { createImageFixture } from '../fixtures/image';
import { createDetectionFixture } from '../fixtures/detection';

describe('POST /api/detections', () => {
	it('creates a detection', async () => {
		const image = await createImageFixture();

		const res = await api()
			.post('/api/detections')
			.send({
				image_id: image.id,
				confidence: 0.95,
				bbox: [0, 0, 10, 10]
			})
			.set('Content-Type', 'application/json');

		expect(res.status).toBe(201);
		expect(res.body).toHaveProperty('detection_id');
	});
});

describe('PATCH /api/detections/:id', () => {
	it('updates detection values', async () => {
		const detection = await createDetectionFixture();
		const detectionId = detection.id;
		const imageId = detection.imageId;

		const patchRes = await api()
			.patch(`/api/detections/${detectionId}`)
			.send({
				areaScore: 85,
				depthScore: 90,
				falsePositive: 1
			})
			.set('Content-Type', 'application/json');

		expect(patchRes.status).toBe(200);
		expect(patchRes.body).toMatchObject({
			id: detectionId,
			imageId: imageId,
			areaScore: 85,
			depthScore: 90,
			falsePositive: 1
		});
	});
});
