import { describe, it, expect } from 'vitest';
import { api } from '../utils/api';
import { createRoverFixture } from '../fixtures/rover';
import { createPathFixture } from '../fixtures/path';

describe('GET /api/rovers/:id/latest-path', () => {
	it('returns the latest path for a rover with paths', async () => {
		const rover = await createRoverFixture();
		
		// Create two paths for the rover with different timestamps
		const path1 = await createPathFixture(rover.id);
		await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
		const path2 = await createPathFixture(rover.id);

		const res = await api().get(`/api/rovers/${rover.id}/latest-path`);
		
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('path_id');
		expect(res.body.path_id).toBe(path2.id); // Should return the most recent path
		expect(res.body).toHaveProperty('timestamp');
	});

	it('returns null path_id for a rover with no paths', async () => {
		const rover = await createRoverFixture();

		const res = await api().get(`/api/rovers/${rover.id}/latest-path`);
		
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('path_id', null);
		expect(res.body).toHaveProperty('message');
	});

	it('returns 400 for invalid rover ID', async () => {
		const res = await api().get('/api/rovers/invalid/latest-path');
		
		expect(res.status).toBe(400);
		expect(res.body).toHaveProperty('error');
	});
});
