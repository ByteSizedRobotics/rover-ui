// ROS Message Types and Interfaces for Rover Data
import type { LidarData } from '../../manual-ctrl/manualControl';

// GPS Fix message structure (sensor_msgs/NavSatFix)
export interface GPSData {
	header: {
		stamp: {
			sec: number;
			nanosec: number;
		};
		frame_id: string;
	};
	status: {
		status: number;
		service: number;
	};
	latitude: number;
	longitude: number;
	altitude: number;
	position_covariance: number[];
	position_covariance_type: number;
}

// IMU Data with Quaternions (sensor_msgs/Imu)
export interface IMUData {
	header: {
		stamp: {
			sec: number;
			nanosec: number;
		};
		frame_id: string;
	};
	orientation: {
		x: number;
		y: number;
		z: number;
		w: number;
	};
	orientation_covariance: number[];
	angular_velocity: {
		x: number;
		y: number;
		z: number;
	};
	angular_velocity_covariance: number[];
	linear_acceleration: {
		x: number;
		y: number;
		z: number;
	};
	linear_acceleration_covariance: number[];
}

// Raw IMU sensor data [roll, pitch, yaw, temp, V]
export interface IMURawData {
	data: [number, number, number, number, number]; // [roll, pitch, yaw, temp, voltage]
}

// Twist message for cmd_vel (geometry_msgs/Twist)
export interface TwistData {
	linear: {
		x: number;
		y: number;
		z: number;
	};
	angular: {
		x: number;
		y: number;
		z: number;
	};
}

// JSON Commands structure
export interface JSONCommand {
	command: string;
	parameters?: Record<string, any>;
	timestamp?: number;
}

// Combined sensor data for the UI
export interface RoverSensorData {
	gps: GPSData | null;
	imu: IMUData | null;
	imuRaw: IMURawData | null;
	lidar: LidarData | null;
	cmdVel: TwistData | null;
	lastJsonCommand: JSONCommand | null;
}

// Processed data for UI display
export interface ProcessedSensorData {
	// GPS
	latitude: number;
	longitude: number;
	altitude: number;
	gpsStatus: 'active' | 'inactive' | 'error';
	
	// IMU processed
	roll: number;
	pitch: number;
	yaw: number;
	temperature: number;
	batteryVoltage: number;
	
	// Movement data
	linearVelocity: number;
	angularVelocity: number;
	
	// System status
	lastUpdate: Date;
	isConnected: boolean;
}

// Utility functions for data conversion
export class RoverDataProcessor {
	// Convert quaternion to Euler angles (roll, pitch, yaw)
	static quaternionToEuler(q: { x: number; y: number; z: number; w: number }): { roll: number; pitch: number; yaw: number } {
		const { x, y, z, w } = q;
		
		// Roll (x-axis rotation)
		const sinr_cosp = 2 * (w * x + y * z);
		const cosr_cosp = 1 - 2 * (x * x + y * y);
		const roll = Math.atan2(sinr_cosp, cosr_cosp);
		
		// Pitch (y-axis rotation)
		const sinp = 2 * (w * y - z * x);
		const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);
		
		// Yaw (z-axis rotation)
		const siny_cosp = 2 * (w * z + x * y);
		const cosy_cosp = 1 - 2 * (y * y + z * z);
		const yaw = Math.atan2(siny_cosp, cosy_cosp);
		
		return {
			roll: roll * 180 / Math.PI,
			pitch: pitch * 180 / Math.PI,
			yaw: yaw * 180 / Math.PI
		};
	}
	
	// Process raw sensor data into UI-friendly format
	static processRoverData(rawData: RoverSensorData): ProcessedSensorData {
		const processed: ProcessedSensorData = {
			latitude: rawData.gps?.latitude || 0,
			longitude: rawData.gps?.longitude || 0,
			altitude: rawData.gps?.altitude || 0,
			gpsStatus: rawData.gps ? 'active' : 'inactive',
			roll: 0,
			pitch: 0,
			yaw: 0,
			temperature: 0,
			batteryVoltage: 0,
			linearVelocity: Math.sqrt(
				Math.pow(rawData.cmdVel?.linear.x || 0, 2) +
				Math.pow(rawData.cmdVel?.linear.y || 0, 2)
			),
			angularVelocity: rawData.cmdVel?.angular.z || 0,
			lastUpdate: new Date(),
			isConnected: Boolean(rawData.gps || rawData.imu || rawData.imuRaw)
		};
		
		// Use raw IMU data if available, otherwise convert from quaternions
		if (rawData.imuRaw?.data) {
			const [roll, pitch, yaw, temp, voltage] = rawData.imuRaw.data;
			processed.roll = roll;
			processed.pitch = pitch;
			processed.yaw = yaw;
			processed.temperature = temp;
			processed.batteryVoltage = voltage;
		} else if (rawData.imu?.orientation) {
			const euler = this.quaternionToEuler(rawData.imu.orientation);
			processed.roll = euler.roll;
			processed.pitch = euler.pitch;
			processed.yaw = euler.yaw;
		}
		
		return processed;
	}
}