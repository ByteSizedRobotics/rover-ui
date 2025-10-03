import { describe, it, expect } from 'vitest';
import { api } from '../utils/api';
import { createRoverFixture } from '../fixtures/rover';


describe('POST /api/rovers/:id/logs', () => {
    it('should add a log entry for a valid rover', async () => {
        const rover = await createRoverFixture();
        const logData = {
            latitude: 37.7749,
            longitude: -122.4194,
            altitude: 10.5,
            roll: 1.2,
            pitch: 2.3,
            yaw: 3.4,
            temperature: 25.6,
            voltage: 12.7
        };

        const res = await api()
            .post(`/api/rovers/${rover.id}/logs`)
            .send(logData);
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('log');
        expect(res.body.log).toMatchObject({
            roverId: rover.id,
            altitude: logData.altitude,
            roll: logData.roll,
            pitch: logData.pitch,
            yaw: logData.yaw,
            temperature: logData.temperature,
            voltage: logData.voltage
        });
    });
});