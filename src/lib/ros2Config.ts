// ROS2 Configuration for Rover Navigation
export const ROS2_CONFIG = {
	// Raspberry Pi connection settings
	RASPBERRY_PI_IP: '100.85.202.20', // Tailscale IP address of the Raspberry Pi
	ROS_BRIDGE_PORT: 9090,
	WEBRTC_PORT_CSI: 8765, // CSI Camera 1 WebRTC port
	WEBRTC_PORT_USB: 8766, // USB Camera WebRTC port
	WEBRTC_PORT_CSI2: 8767, // CSI Camera 2 WebRTC port

	// ROS2 Topics
	TOPICS: {
		// Command Center Communication (data sent from SW -> ROVER)
		ROVER_COMMAND: '/command', // Commands to rover (LaunchRover, ManualControl, Stop)
		ROVER_SWDATA: '/gps_waypoints', // Software data (waypoints, navigation params)
		ROVER_HEARTBEAT: '/heartbeat', // Heartbeat from software to rover
		MOTOR_MANUAL_JSON_COMMAND: '/JSON', // JSON motor command topic for manual control

		// ROVER_STATE: '/rover_state', // Rover state updates (idle, manual_control, autonomous)
		// ROVER_LOCATION: "/rover_location",          // Internal rover location topic

		// Sensor and Navigation Topics (data sent from ROVER -> SW)
		GPS: '/fix', // GPS data (current rover location)
		// IMU_DATA: '/imu/data', // IMU data (Transformed to Quaternions)
		IMU_RAW: '/imu/raw', // Raw sensor data [roll, pitch, yaw, temp, V]
		LIDAR: '/scan', // Lidar scan data
		// CMD_VEL: '/cmd_vel', // Nav2 output movements
		TIMESTAMP: '/timestamp', // Timestamps for synchronization
		NODE_STATUS: '/node_status', // Node status updates from command centre
		OBSTACLE_DETECTED: '/obstacle_detected',
		OBSTACLE_DISTANCE: '/obstacle_distance'
	},

	// Connection timeout settings
	CONNECTION_TIMEOUT: 5000, // 5 seconds
	RETRY_ATTEMPTS: 3,
	RETRY_DELAY: 2000 // 2 seconds
};

// Helper function to validate IP address
export function isValidIP(ip: string): boolean {
	const parts = ip.split('.');
	return (
		parts.length === 4 &&
		parts.every((part) => {
			const num = parseInt(part, 10);
			return num >= 0 && num <= 255 && !isNaN(num);
		})
	);
}

// Helper function to get WebSocket URL
export function getROSWebSocketURL(ip?: string, port?: number): string {
	const rosIP = ip || ROS2_CONFIG.RASPBERRY_PI_IP;
	const rosPort = port || ROS2_CONFIG.ROS_BRIDGE_PORT;
	return `ws://${rosIP}:${rosPort}`;
}

// Helper function to get WebRTC WebSocket URL
export function getWebRTCWebSocketURL(cameraType: 'csi' | 'usb' | 'csi2' = 'csi', ip?: string): string {
	const rosIP = ip || ROS2_CONFIG.RASPBERRY_PI_IP;
	let webrtcPort: number;
	
	if (cameraType === 'csi') {
		webrtcPort = ROS2_CONFIG.WEBRTC_PORT_CSI;
	} else if (cameraType === 'usb') {
		webrtcPort = ROS2_CONFIG.WEBRTC_PORT_USB;
	} else {
		webrtcPort = ROS2_CONFIG.WEBRTC_PORT_CSI2;
	}
	
	return `ws://${rosIP}:${webrtcPort}`;
}
