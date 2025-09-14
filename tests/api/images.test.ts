// tests/api/image.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { api } from '../utils/api'; // your Supertest wrapper
import { createPathFixture } from '../fixtures/path';
import { createImageFixture } from '../fixtures/image';


describe('GET /api/images', () => {
	it('returns all images', async () => {
		const res = await api().get('/api/images');
		expect(res.status).toBe(200);
		expect(Array.isArray(res.body)).toBe(true);
	});
});


describe('POST /api/images', () => {
	it('uploads an image and inserts into DB', async () => {
		const pathRow = (await createPathFixture()) as { id: number };

		const dummyFilePath = path.join(process.cwd(), 'tests/utils', 'dummy.jpg');
		if (!fs.existsSync(dummyFilePath)) {
			fs.writeFileSync(dummyFilePath, Buffer.from([0xff, 0xd8, 0xff])); // minimal JPEG header
		}

		const res = await api()
			.post('/api/images')
			.field('pathId', pathRow.id.toString()) // optional, if your endpoint reads this from FormData
			.field('latitude', '0')
			.field('longitude', '0')
			.attach('image', dummyFilePath); // this is the key your endpoint reads

		expect(res.status).toBe(201);
		expect(res.body).toHaveProperty('image_id');
	});
});


describe('GET /api/images/:id', () => {
	it('retrieves a specific image by ID', async () => {
		const image = await createImageFixture();

		const res = await api().get(`/api/images/${image.id}`);
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('id', image.id);
	});
});


describe('DELETE /api/images/:id', () => {
	it('deletes a specific image by ID', async () => {
		const image = await createImageFixture();
		const imageId = image.id;

		const res = await api().get(`/api/images/${imageId}`);
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('id', imageId);

		const deleteRes = await api().delete(`/api/images/${imageId}`);
		expect(deleteRes.status).toBe(200);

		const getRes = await api().get(`/api/images/${imageId}`);
		expect(getRes.status).toBe(404);
	});
});
