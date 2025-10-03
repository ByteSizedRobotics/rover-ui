import { describe, it, expect } from 'vitest';
import { api } from '../utils/api';
import { createRoverFixture } from '../fixtures/rover';


describe('POST /api/rovers/:id/heartbeat', () => {
    it('updates the rover heartbeat successfully', async () => {
        const rover = await createRoverFixture();
        const roverId = rover.id;
        const rover_time_before = rover.lastHeartbeat ? new Date(rover.lastHeartbeat).getTime() : 0;

        const res = await api().post(`/api/rovers/${roverId}/heartbeat`);
        const rover_time_after = new Date(res.body.lastHeartbeat).getTime();
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ id: roverId, lastHeartbeat: res.body.lastHeartbeat });
        expect(res.body.lastHeartbeat).not.toBeNull();
        expect(rover_time_after).toBeGreaterThan(rover_time_before);
    });
});