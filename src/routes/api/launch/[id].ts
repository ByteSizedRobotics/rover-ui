import type { RequestHandler } from '@sveltejs/kit';
import { ROS2_CONFIG, getROSWebSocketURL } from '../../../lib/ros2Config';

// Simple ROS2 waypoint interface
interface Waypoint {
	lat: number;
	lng: number;
}

// ROS2 bridge communication helper
class ROS2Bridge {
	static async sendWaypoints(waypoints: Waypoint[], roverId: string): Promise<boolean> {
		try {
			// Create WebSocket connection to ROS2 bridge
			const wsUrl = getROSWebSocketURL();

			return new Promise((resolve, reject) => {
				const socket = new WebSocket(wsUrl);

				socket.onopen = () => {
					// Send waypoints to ROS2 navigation topic
					const message = {
						op: 'publish',
						topic: ROS2_CONFIG.TOPICS.WAYPOINTS,
						msg: {
							rover_id: roverId,
							waypoints: waypoints.map((wp, index) => ({
								id: index,
								latitude: wp.lat,
								longitude: wp.lng,
								altitude: 0.0
							})),
							timestamp: Date.now()
						}
					};

					socket.send(JSON.stringify(message));

					// Close connection after sending
					setTimeout(() => {
						socket.close();
						resolve(true);
					}, 1000);
				};

				socket.onerror = (error) => {
					console.error('ROS2 bridge connection error:', error);
					reject(false);
				};

				socket.onclose = () => {
					resolve(true);
				};
			});
		} catch (error) {
			console.error('Failed to send waypoints to ROS2:', error);
			return false;
		}
	}
}

export const POST: RequestHandler = async ({ params, request }) => {
	const id = params.id;
	if (!id) {
		return new Response(JSON.stringify({ success: false, message: 'Missing rover ID' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		const body = await request.json();
		console.log(`Launch request for rover ${id}:`, body);

		const waypoints: Waypoint[] = body.waypoints || [];
		let rosStatus = 'No waypoints to send';

		// Send waypoints to ROS2 if available
		if (waypoints.length > 0) {
			try {
				const success = await ROS2Bridge.sendWaypoints(waypoints, id);
				rosStatus = success ? 'Waypoints sent to ROS2 navigation system' : 'Failed to send to ROS2';
			} catch (error) {
				console.error('ROS2 communication error:', error);
				rosStatus = 'ROS2 communication failed';
			}
		}

		return new Response(
			JSON.stringify({
				success: true,
				message: `Launch command queued for rover ${id}. ${rosStatus}`,
				waypoints_count: waypoints.length,
				ros_status: rosStatus
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (err) {
		console.error('Error in launch API:', err);
		return new Response(JSON.stringify({ success: false, message: 'Invalid request' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
