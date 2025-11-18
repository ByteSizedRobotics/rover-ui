import type { RequestHandler } from '@sveltejs/kit';
import { commandCenterManager } from '$lib/ros2CommandCentre';

export const GET: RequestHandler = async ({ params }) => {
	const roverId = params.id;

	if (!roverId) {
		return new Response(JSON.stringify({ error: 'Rover ID is required' }), { status: 400 });
	}

	try {
		// Get the command center client for this rover
		const client = commandCenterManager.getClient(roverId);
		const gpsData = client.gpsData;

		if (!gpsData) {
			return new Response(
				JSON.stringify({ 
					error: 'No GPS data available',
					latitude: 0,
					longitude: 0,
					altitude: 0
				}),
				{ 
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		return new Response(
			JSON.stringify({
				latitude: gpsData.latitude,
				longitude: gpsData.longitude,
				altitude: gpsData.altitude
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (err) {
		console.error('Error fetching GPS data:', err);
		return new Response(
			JSON.stringify({ 
				error: 'Internal Server Error',
				latitude: 0,
				longitude: 0,
				altitude: 0
			}),
			{ status: 500 }
		);
	}
};
