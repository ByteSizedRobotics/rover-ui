import { describe, it, expect } from 'vitest';
import { api } from '../utils/api';
import { createRoverFixture } from '../fixtures/rover';


describe(`GET /api/rovers`, () => {
    it('retrieves all rovers', async () => {
        const rover1 = await createRoverFixture();
        const rover2 = await createRoverFixture();

        const res = await api().get('/api/rovers');
        expect(res.status).toBe(200);
        expect(res.body.roversData.length).toBeGreaterThanOrEqual(2);
        expect(res.body.roversData).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: rover1.id }),
                expect.objectContaining({ id: rover2.id })
            ])
        );
    });
});


describe(`POST /api/rovers`, () => {
    it('creates a new rover', async () => {
        const res = await api()
            .post('/api/rovers')
            .send({
                name: 'Test Rover',
                ipAddress: '192.168.1.100'
            });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('rover');
    });
});


describe(`GET /api/rovers/:id`, () => {
    it('retrieves a specific rover by ID', async () => {
        const rover = await createRoverFixture();
        const res = await api().get(`/api/rovers/${rover.id}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id', rover.id);
    }
    );
});


describe(`DELETE /api/rovers/:id`, () => {
    it('deletes a specific rover by ID', async () => {
        const rover = await createRoverFixture();
        const res = await api().delete(`/api/rovers/${rover.id}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message', 'Rover deleted successfully');
        
        // Verify the rover is actually deleted
        const getRes = await api().get(`/api/rovers/${rover.id}`);
        expect(getRes.status).toBe(404);
    }
    );
});
