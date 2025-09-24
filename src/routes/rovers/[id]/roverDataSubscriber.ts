// ROS Data Subscriber Service for Rover Dashboard
import { ROS2_CONFIG, getROSWebSocketURL } from '../../../lib/ros2Config';
import type { 
	GPSData, 
	IMUData, 
	IMURawData, 
	TwistData, 
	JSONCommand, 
	RoverSensorData, 
	ProcessedSensorData
} from './roverDataTypes';
import { RoverDataProcessor } from './roverDataTypes';
import type { LidarData } from '../../manual-ctrl/manualControl';

export interface RoverDataSubscriberConfig {
	onDataUpdate?: (data: ProcessedSensorData) => void;
	onRawDataUpdate?: (data: RoverSensorData) => void;
	onConnectionChange?: (connected: boolean) => void;
	onError?: (error: string) => void;
}

export class RoverDataSubscriber {
	private ros: any = null;
	private rosWebSocket: WebSocket | null = null;
	private isConnected = false;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectTimeout: number | null = null;
	
	// Topic subscribers
	private gpsListener: any = null;
	private imuDataListener: any = null;
	private imuRawListener: any = null;
	private lidarListener: any = null;
	private cmdVelListener: any = null;
	private jsonListener: any = null;
	
	// Data storage
	private sensorData: RoverSensorData = {
		gps: null,
		imu: null,
		imuRaw: null,
		lidar: null,
		cmdVel: null,
		lastJsonCommand: null
	};
	
	// Configuration and callbacks
	private config: RoverDataSubscriberConfig;
	
	constructor(config: RoverDataSubscriberConfig = {}) {
		this.config = config;
	}
	
	// Connect to ROS bridge
	async connect(): Promise<void> {
		try {
			// Dynamically import ROSLIB
			const ROSLIB = await import('roslib');
			
			const rosUrl = getROSWebSocketURL();
			console.log(`Connecting to ROS bridge at: ${rosUrl}`);
			
			this.ros = new ROSLIB.Ros({
				url: rosUrl
			});
			
			// Set up connection event handlers
			this.ros.on('connection', () => {
				console.log('Connected to ROS bridge');
				this.isConnected = true;
				this.reconnectAttempts = 0;
				this.config.onConnectionChange?.(true);
				this.subscribeToTopics();
			});
			
			this.ros.on('error', (error: any) => {
				console.error('ROS connection error:', error);
				this.isConnected = false;
				this.config.onConnectionChange?.(false);
				this.config.onError?.(`Connection error: ${error.message || error}`);
				this.attemptReconnection();
			});
			
			this.ros.on('close', () => {
				console.log('ROS connection closed');
				this.isConnected = false;
				this.config.onConnectionChange?.(false);
				this.cleanup();
				this.attemptReconnection();
			});
			
		} catch (error) {
			console.error('Failed to connect to ROS:', error);
			this.config.onError?.(`Failed to connect: ${error}`);
		}
	}
	
	// Subscribe to all required topics
	private async subscribeToTopics(): Promise<void> {
		if (!this.ros) return;
		
		try {
			const ROSLIB = await import('roslib');
			
			// GPS Topic
			this.gpsListener = new ROSLIB.Topic({
				ros: this.ros,
				name: ROS2_CONFIG.TOPICS.GPS,
				messageType: 'sensor_msgs/NavSatFix'
			});
			
			this.gpsListener.subscribe((message: GPSData) => {
				this.sensorData.gps = message;
				this.notifyDataUpdate();
			});
			
			// IMU Data Topic (Quaternions)
			this.imuDataListener = new ROSLIB.Topic({
				ros: this.ros,
				name: ROS2_CONFIG.TOPICS.IMU_DATA,
				messageType: 'sensor_msgs/Imu'
			});
			
			this.imuDataListener.subscribe((message: IMUData) => {
				this.sensorData.imu = message;
				this.notifyDataUpdate();
			});
			
			// IMU Raw Topic (Array data)
			this.imuRawListener = new ROSLIB.Topic({
				ros: this.ros,
				name: ROS2_CONFIG.TOPICS.IMU_RAW,
				messageType: 'std_msgs/Float64MultiArray'
			});
			
			this.imuRawListener.subscribe((message: { data: number[] }) => {
				if (message.data && message.data.length === 5) {
					this.sensorData.imuRaw = {
						data: message.data as [number, number, number, number, number]
					};
					this.notifyDataUpdate();
				}
			});
			
			// Lidar Topic
			this.lidarListener = new ROSLIB.Topic({
				ros: this.ros,
				name: ROS2_CONFIG.TOPICS.LIDAR,
				messageType: 'sensor_msgs/LaserScan'
			});
			
			this.lidarListener.subscribe((message: LidarData) => {
				this.sensorData.lidar = message;
				this.notifyDataUpdate();
			});
			
			// CMD_VEL Topic (Navigation commands)
			this.cmdVelListener = new ROSLIB.Topic({
				ros: this.ros,
				name: ROS2_CONFIG.TOPICS.CMD_VEL,
				messageType: 'geometry_msgs/Twist'
			});
			
			this.cmdVelListener.subscribe((message: TwistData) => {
				this.sensorData.cmdVel = message;
				this.notifyDataUpdate();
			});
			
			// JSON Commands Topic
			this.jsonListener = new ROSLIB.Topic({
				ros: this.ros,
				name: ROS2_CONFIG.TOPICS.JSON_COMMANDS,
				messageType: 'std_msgs/String'
			});
			
			this.jsonListener.subscribe((message: { data: string }) => {
				try {
					const jsonCommand: JSONCommand = JSON.parse(message.data);
					this.sensorData.lastJsonCommand = jsonCommand;
					this.notifyDataUpdate();
				} catch (error) {
					console.error('Failed to parse JSON command:', error);
				}
			});
			
			console.log('Successfully subscribed to all ROS topics');
			
		} catch (error) {
			console.error('Failed to subscribe to topics:', error);
			this.config.onError?.(`Failed to subscribe to topics: ${error}`);
		}
	}
	
	// Notify subscribers of data updates
	private notifyDataUpdate(): void {
		// Notify raw data subscribers
		this.config.onRawDataUpdate?.(this.sensorData);
		
		// Process and notify processed data subscribers
		const processedData = RoverDataProcessor.processRoverData(this.sensorData);
		this.config.onDataUpdate?.(processedData);
	}
	
	// Attempt reconnection with exponential backoff
	private attemptReconnection(): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.log('Max reconnection attempts reached');
			this.config.onError?.('Failed to reconnect after maximum attempts');
			return;
		}
		
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
		}
		
		const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
		this.reconnectAttempts++;
		
		console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
		
		this.reconnectTimeout = window.setTimeout(() => {
			this.connect();
		}, delay);
	}
	
	// Clean up all subscriptions
	private cleanup(): void {
		if (this.gpsListener) {
			this.gpsListener.unsubscribe();
			this.gpsListener = null;
		}
		if (this.imuDataListener) {
			this.imuDataListener.unsubscribe();
			this.imuDataListener = null;
		}
		if (this.imuRawListener) {
			this.imuRawListener.unsubscribe();
			this.imuRawListener = null;
		}
		if (this.lidarListener) {
			this.lidarListener.unsubscribe();
			this.lidarListener = null;
		}
		if (this.cmdVelListener) {
			this.cmdVelListener.unsubscribe();
			this.cmdVelListener = null;
		}
		if (this.jsonListener) {
			this.jsonListener.unsubscribe();
			this.jsonListener = null;
		}
	}
	
	// Disconnect and cleanup
	disconnect(): void {
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
		
		this.cleanup();
		
		if (this.ros) {
			this.ros.close();
			this.ros = null;
		}
		
		this.isConnected = false;
		this.config.onConnectionChange?.(false);
	}
	
	// Getters for current data
	getCurrentData(): ProcessedSensorData {
		return RoverDataProcessor.processRoverData(this.sensorData);
	}
	
	getRawData(): RoverSensorData {
		return { ...this.sensorData };
	}
	
	getConnectionStatus(): boolean {
		return this.isConnected;
	}
	
	// Utility method to get specific sensor reading
	getGPSPosition(): { lat: number; lng: number; altitude: number } | null {
		if (!this.sensorData.gps) return null;
		
		return {
			lat: this.sensorData.gps.latitude,
			lng: this.sensorData.gps.longitude,
			altitude: this.sensorData.gps.altitude
		};
	}
	
	// Get battery and temperature from raw IMU data
	getBatteryInfo(): { voltage: number; temperature: number } | null {
		if (!this.sensorData.imuRaw?.data) return null;
		
		const [, , , temp, voltage] = this.sensorData.imuRaw.data;
		return { voltage, temperature: temp };
	}
	
	// Get current movement information
	getMovementInfo(): { linear: number; angular: number } | null {
		if (!this.sensorData.cmdVel) return null;
		
		const linearSpeed = Math.sqrt(
			Math.pow(this.sensorData.cmdVel.linear.x, 2) +
			Math.pow(this.sensorData.cmdVel.linear.y, 2)
		);
		
		return {
			linear: linearSpeed,
			angular: this.sensorData.cmdVel.angular.z
		};
	}
}