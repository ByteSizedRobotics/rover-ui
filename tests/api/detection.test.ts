import { describe, it, expect } from 'vitest';
import { api } from '../utils/api';
import { createImageFixture } from '../fixtures/image';

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
