import { describe, it, expect } from 'vitest';
import { api } from '../utils/api';
import { createLogFixture } from '../fixtures/log';
import { createRoverFixture } from '../fixtures/rover';

describe('GET /api/rovers/:id/logs', () => {
	it('should return logs for a valid rover', async () => {
		const log1 = await createLogFixture();
		const log2 = await createLogFixture(log1.roverId);

		const res = await api().get(`/api/rovers/${log1.roverId}/logs`);
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('logs');
		expect(res.body.logs.length).toBeGreaterThanOrEqual(2);
		expect(res.body.logs[0]).toHaveProperty('roverId', log1.roverId);

		// Ensure the latest log is first
		const [firstLog, secondLog] = res.body.logs;
		expect(new Date(firstLog.timestamp).getTime()).toBeGreaterThanOrEqual(
			new Date(secondLog.timestamp).getTime()
		);
	});
});

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

		const res = await api().post(`/api/rovers/${rover.id}/logs`).send(logData);
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
