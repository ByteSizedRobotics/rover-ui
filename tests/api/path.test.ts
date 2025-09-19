import { describe, it, expect } from 'vitest';
import { api } from '../utils/api';
import { createPathFixture } from '../fixtures/path';
import { createRoverFixture } from '../fixtures/rover';


const sampleLineString1 = 'LINESTRING(0 0, 1 1, 2 3)';
const sampleLineString2 = 'LINESTRING(3 3, 4 4, 5 5)';
const sampleGeoJSON1 = {
    type: 'LineString',
    coordinates: [
        [0, 0],
        [1, 1],
        [2, 3]
    ]
};
const sampleGeoJSON2 = {
    type: 'LineString',
    coordinates: [
        [3, 3],
        [4, 4],
        [5, 5]
    ]
};

describe('GET /api/paths', () => {
    it('retrieves all paths with correct linestring geometry', async () => {
        const path1 = await createPathFixture(undefined, sampleLineString1);
        const path2 = await createPathFixture(undefined, sampleLineString2);

        const res = await api().get('/api/paths');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: path1.id,
                    route: sampleGeoJSON1
                }),
                expect.objectContaining({
                    id: path2.id,
                    route: sampleGeoJSON2
                })
            ])
        );
    });
});


describe('POST /api/paths', () => {
    it('creates a path with valid rover_id and routeWKT', async () => {
        const rover = await createRoverFixture();
        const rover_id = rover.id;

        const res = await api()
            .post('/api/paths')
            .send({
                rover_id,
                routeWKT: sampleLineString1
            })
            .set('Content-Type', 'application/json');

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            rover_id,
            route: sampleGeoJSON1
        });
    });
});


describe('GET /api/paths/:id', () => {
    it('retrieves a specific path by ID with correct linestring geometry', async () => {
        const path = await createPathFixture(undefined, sampleLineString1);

        const res = await api().get(`/api/paths/${path.id}`);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            id: path.id,
            rover_id: path.rover_id,
            route: sampleGeoJSON1
        });
    });
});


describe('DELETE /api/paths/:id', () => {
    it('deletes a specific path by ID', async () => {
        const path = await createPathFixture(undefined, sampleLineString1);

        const res = await api().delete(`/api/paths/${path.id}`);
        expect(res.status).toBe(204);

        const fetchRes = await api().get(`/api/paths/${path.id}`);
        expect(fetchRes.status).toBe(404);
    });
});
