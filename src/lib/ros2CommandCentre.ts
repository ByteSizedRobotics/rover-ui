import { ROS2_CONFIG, getROSWebSocketURL, getWebRTCWebSocketURL } from './ros2Config';

/**
 * ROS2 Command Center Client
 *
 * This module handles communication with the rover command center node.
 * It manages commands, software data, heartbeat, and rover state monitoring.
 */

export interface RoverCommand {
	type: 'LaunchRover' | 'ManualControl' | 'Stop';
	params?: Record<string, any>;
	timestamp?: number;
}

export interface RoverSoftwareData {
	type: 'waypoints' | 'navigation_params' | 'manual_command';
	data: Record<string, any>;
	timestamp?: number;
}

export interface RoverState {
	state: 'idle' | 'manual_control' | 'autonomous';
	timestamp: number;
	roverId?: string;
}

export interface CommandCenterStatus {
	isConnected: boolean;
	lastHeartbeat: number;
	connectionErrors: number;
	roverState: string;
	isNavigating?: boolean;
	currentWaypoint?: number;
	totalWaypoints?: number;
}

export interface GPSData {
	latitude: number;
	longitude: number;
	altitude: number;
	accuracy?: number;
	timestamp: number;
}

export interface IMUData {
	orientation: {
		x: number;
		y: number;
		z: number;
		w: number;
	};
	angular_velocity: {
		x: number;
		y: number;
		z: number;
	};
	linear_acceleration: {
		x: number;
		y: number;
		z: number;
	};
	timestamp: number;
}

export interface IMURawData {
	roll: number;
	pitch: number;
	yaw: number;
	temperature: number;
	voltage: number;
	timestamp: number;
}

export interface LidarData {
	ranges: number[];
	angle_min: number;
	angle_max: number;
	angle_increment: number;
	range_min: number;
	range_max: number;
	timestamp: number;
}

export interface CmdVelData {
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
	timestamp: number;
}

export interface ObstacleData {
	detected: boolean;
	distance?: number;
	timestamp: number;
}

export class ROS2CommandCentreClient {
	private _socket: WebSocket | null = null;
	private _isConnected: boolean = false;
	private _roverId: string;
	private _heartbeatInterval: NodeJS.Timeout | null = null;
	private _lastHeartbeat: number = 0;
	private _connectionErrors: number = 0;
	private _roverState: string = 'unknown';
	private _isNavigating: boolean = false;
	private _currentWaypoint: number = 0;
	private _totalWaypoints: number = 0;
	private _onStateChange: ((status: CommandCenterStatus) => void) | null = null;
	private _onRoverStateUpdate: ((state: RoverState) => void) | null = null;
	private _onLidarDataUpdate: ((data: LidarData) => void) | null = null;

	// WebRTC camera stream properties
	private _webrtcSocket: WebSocket | null = null;
	private _peerConnection: RTCPeerConnection | null = null;
	private _isWebRTCConnected: boolean = false;

	// Topic data storage
	private _gpsData: GPSData | null = null;
	private _imuData: IMUData | null = null;
	private _imuRawData: IMURawData | null = null;
	private _lidarData: LidarData | null = null;
	private _cmdVelData: CmdVelData | null = null;
	private _jsonCommands: any | null = null;
	private _legacyCommands: any | null = null;
	private _obstacleData: ObstacleData | null = null;

	constructor(roverId: string) {
		this._roverId = roverId;
	}

	// Getters
	get isConnected(): boolean {
		return this._isConnected;
	}
	get roverState(): string {
		return this._roverState;
	}
	get isNavigating(): boolean {
		return this._isNavigating;
	}
	get currentWaypoint(): number {
		return this._currentWaypoint;
	}
	get totalWaypoints(): number {
		return this._totalWaypoints;
	}
	get gpsData(): GPSData | null {
		return this._gpsData;
	}
	get imuData(): IMUData | null {
		return this._imuData;
	}
	get imuRawData(): IMURawData | null {
		return this._imuRawData;
	}
	get lidarData(): LidarData | null {
		return this._lidarData;
	}
	get cmdVelData(): CmdVelData | null {
		return this._cmdVelData;
	}
	get jsonCommands(): any | null {
		return this._jsonCommands;
	}
	get legacyCommands(): any | null {
		return this._legacyCommands;
	}
	get obstacleData(): ObstacleData | null {
		return this._obstacleData;
	}
	get isWebRTCConnected(): boolean {
		return this._isWebRTCConnected;
	}
	get obstacleDetected(): boolean {
		return this._obstacleData?.detected || false;
	}
	get obstacleDistance(): number {
		return this._obstacleData?.distance || 0;
	}
	get status(): CommandCenterStatus {
		return {
			isConnected: this._isConnected,
			lastHeartbeat: this._lastHeartbeat,
			connectionErrors: this._connectionErrors,
			roverState: this._roverState,
			isNavigating: this._isNavigating,
			currentWaypoint: this._currentWaypoint,
			totalWaypoints: this._totalWaypoints
		};
	}

	/**
	 * Connect to the ROS2 Command Center
	 */
	async connect(): Promise<void> {
		if (this._isConnected) {
			return;
		}

		return new Promise((resolve, reject) => {
			try {
				const wsUrl = getROSWebSocketURL();
				this._socket = new WebSocket(wsUrl);

				this._socket.onopen = () => {
					this._isConnected = true;
					this._connectionErrors = 0;
					console.log(`Connected to ROS2 Command Center for rover ${this._roverId}`);

					// Subscribe to rover state updates
					// this.subscribeToRoverState();

					// Subscribe to all sensor and command topics
					this.subscribeToGPS();
					this.subscribeToIMUData();
					this.subscribeToIMURaw();
					this.subscribeToLidar();
					// this.subscribeToCmdVel();
					// this.subscribeToLegacyCommands();
					this.subscribeToObstacleDetected();
					this.subscribeToObstacleDistance();

					// Start heartbeat
					this.startHeartbeat();

					// Initialize WebRTC connection for camera stream
					this.connectWebRTC();

					this.notifyStateChange();
					resolve();
				};

				this._socket.onerror = (error) => {
					this._connectionErrors++;
					console.error('ROS2 Command Center connection error:', error);
					this.notifyStateChange();
					reject(new Error('Failed to connect to ROS2 Command Center'));
				};

				this._socket.onclose = () => {
					this._isConnected = false;
					this.stopHeartbeat();
					console.log('ROS2 Command Center connection closed');
					this.notifyStateChange();
				};

				this._socket.onmessage = (event) => {
					this.handleMessage(event);
				};
			} catch (error) {
				this._connectionErrors++;
				this.notifyStateChange();
				reject(error);
			}
		});
	}

	/**
	 * Disconnect from the ROS2 Command Center
	 */
	disconnect(): void {
		this.stopHeartbeat();
		this.disconnectWebRTC();

		if (this._socket) {
			// Unsubscribe from all topics
			this.unsubscribeFromAllTopics();
			this._socket.close();
			this._socket = null;
		}

		this._isConnected = false;
		this.notifyStateChange();
	}

	/**
	 * Connect WebRTC for camera streaming
	 */
	private async connectWebRTC(): Promise<void> {
		try {
			const webrtcUrl = getWebRTCWebSocketURL();
			this._webrtcSocket = new WebSocket(webrtcUrl);

			this._webrtcSocket.onopen = () => {
				console.log(`WebRTC connection established for rover ${this._roverId}`);
				this.startWebRTC();
			};

			this._webrtcSocket.onerror = (error) => {
				console.error(`WebRTC connection error for rover ${this._roverId}:`, error);
				this._isWebRTCConnected = false;
			};

			this._webrtcSocket.onclose = () => {
				console.log(`WebRTC connection closed for rover ${this._roverId}`);
				this._isWebRTCConnected = false;
			};

			this._webrtcSocket.onmessage = (event) => {
				this.handleWebRTCMessage(event);
			};
		} catch (error) {
			console.error(`Failed to connect WebRTC for rover ${this._roverId}:`, error);
			this._isWebRTCConnected = false;
		}
	}

	/**
	 * Disconnect WebRTC
	 */
	private disconnectWebRTC(): void {
		if (this._peerConnection) {
			this._peerConnection.close();
			this._peerConnection = null;
		}

		if (this._webrtcSocket) {
			this._webrtcSocket.close();
			this._webrtcSocket = null;
		}

		this._isWebRTCConnected = false;
	}

	/**
	 * Start WebRTC peer connection
	 */
	private async startWebRTC(): Promise<void> {
		try {
			console.log(`Starting WebRTC connection for rover ${this._roverId}...`);

			// Initialize WebRTC peer connection
			this._peerConnection = new RTCPeerConnection({
				iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }]
			});

			// Ensure the WebRTC offer requests a video stream (without adding a local camera)
			this._peerConnection.addTransceiver('video', { direction: 'recvonly' });

			// Handle incoming video stream
			this._peerConnection.ontrack = (event) => {
				console.log(`WebRTC video stream received for rover ${this._roverId}`);
				// The video element will be set up by the UI component using setVideoElement
			};

			// Handle ICE candidates
			this._peerConnection.onicecandidate = (event) => {
				if (event.candidate && this._webrtcSocket) {
					this._webrtcSocket.send(JSON.stringify({ 
						type: 'candidate', 
						candidate: event.candidate 
					}));
				}
			};

			// Create an offer and send it to the server
			const offer = await this._peerConnection.createOffer();
			await this._peerConnection.setLocalDescription(offer);

			if (this._webrtcSocket) {
				this._webrtcSocket.send(JSON.stringify({ 
					type: 'offer', 
					sdp: offer.sdp 
				}));
				console.log(`WebRTC offer sent to ROS 2 server for rover ${this._roverId}`);
			}

			this._isWebRTCConnected = true;
		} catch (error) {
			console.error(`Error starting WebRTC for rover ${this._roverId}:`, error);
			this._isWebRTCConnected = false;
		}
	}

	/**
	 * Handle WebRTC signaling messages
	 */
	private handleWebRTCMessage(event: MessageEvent): void {
		try {
			const data = JSON.parse(event.data);

			switch (data.type) {
				case 'answer':
					if (this._peerConnection) {
						this._peerConnection.setRemoteDescription(new RTCSessionDescription(data));
						console.log(`WebRTC answer received and applied for rover ${this._roverId}`);
					}
					break;

				case 'ice-candidate':
					if (this._peerConnection && data.candidate) {
						this._peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
						console.log(`ICE candidate received and added for rover ${this._roverId}`);
					}
					break;

				default:
					console.log(`Received unknown WebRTC message type: ${data.type}`);
					break;
			}
		} catch (error) {
			console.error(`Error parsing WebRTC message for rover ${this._roverId}:`, error);
		}
	}

	/**
	 * Set video element for WebRTC stream
	 */
	public setVideoElement(videoElementId: string): void {
		if (!this._peerConnection) {
			console.warn(`WebRTC not initialized for rover ${this._roverId}`);
			return;
		}

		// Set up ontrack handler to set video stream to the specified element
		this._peerConnection.ontrack = (event) => {
			const videoElement = document.getElementById(videoElementId) as HTMLVideoElement;
			if (videoElement) {
				videoElement.srcObject = event.streams[0];
				videoElement.play().catch(e => {
					console.error(`Error playing video for rover ${this._roverId}:`, e);
				});
				console.log(`WebRTC video stream set for rover ${this._roverId}`);
			} else {
				console.error(`Video element with id '${videoElementId}' not found for rover ${this._roverId}`);
			}
		};
	}

	/**
	 * Send a command to the rover
	 */
	async sendCommand(command: RoverCommand): Promise<void> {
		if (!this._isConnected || !this._socket) {
			throw new Error('Not connected to ROS2 Command Center');
		}

		const message = {
			op: 'publish',
			topic: ROS2_CONFIG.TOPICS.ROVER_COMMAND,
			msg: {
				data: JSON.stringify({
					...command,
					timestamp: Date.now(),
					rover_id: this._roverId
				})
			}
		};

		this._socket.send(JSON.stringify(message));
		console.log(`Sent command to rover ${this._roverId}:`, command.type);
	}

	/**
	 * Send manual control command (movement commands like Forward, Stop, etc.)
	 */
	async sendManualCommand(action: string, speed?: number): Promise<void> {
		if (!this._isConnected || !this._socket) {
			throw new Error('Not connected to ROS2 Command Center');
		}

		const command = {
			action,
			speed: speed || 1,
			roverId: this._roverId,
			timestamp: new Date().toISOString()
		};

		// Send on the legacy COMMAND topic for manual control
		const message = {
			op: 'publish',
			topic: ROS2_CONFIG.TOPICS.COMMAND,
			msg: {
				data: JSON.stringify(command)
			}
		};

		this._socket.send(JSON.stringify(message));
		console.log(`Sent manual command to rover ${this._roverId}:`, action);
	}

	/**
	 * Send software data to the rover
	 */
	async sendSoftwareData(data: RoverSoftwareData): Promise<void> {
		if (!this._isConnected || !this._socket) {
			throw new Error('Not connected to ROS2 Command Center');
		}

		const message = {
			op: 'publish',
			topic: ROS2_CONFIG.TOPICS.ROVER_SWDATA,
			msg: {
				data: JSON.stringify({
					...data,
					timestamp: Date.now(),
					rover_id: this._roverId
				})
			}
		};

		this._socket.send(JSON.stringify(message));
		console.log(`Sent software data to rover ${this._roverId}:`, data.type);
	}

	/**
	 * Launch the rover with waypoints
	 */
	async launchRover(waypoints: Array<{ lat: number; lng: number }>): Promise<void> {
		// Set navigation state
		this._totalWaypoints = waypoints.length;
		this._currentWaypoint = 0;
		this._isNavigating = true;
		this.notifyStateChange();

		// First send the LaunchRover command
		await this.sendCommand({
			type: 'LaunchRover',
			params: {
				waypoint_count: waypoints.length,
				launch_mode: 'autonomous'
			}
		});

		// Then send the waypoints data
		await this.sendSoftwareData({
			type: 'waypoints',
			data: {
				waypoints: waypoints.map((wp, index) => ({
					id: index,
					latitude: wp.lat,
					longitude: wp.lng,
					altitude: 0.0
				}))
			}
		});
	}

	/**
	 * Switch to manual control mode
	 */
	async enableManualControl(): Promise<void> {
		await this.sendCommand({
			type: 'ManualControl',
			params: {
				control_mode: 'manual'
			}
		});
	}

	/**
	 * Stop all rover operations
	 */
	async stopRover(): Promise<void> {
		await this.sendCommand({
			type: 'Stop',
			params: {
				emergency: false
			}
		});

		// Update navigation state
		this._isNavigating = false;
		this._currentWaypoint = 0;
		this._totalWaypoints = 0;
		this.notifyStateChange();
	}

	/**
	 * Set state change callback
	 */
	onStateChange(callback: (status: CommandCenterStatus) => void): void {
		this._onStateChange = callback;
	}

	/**
	 * Set rover state update callback
	 */
	onRoverStateUpdate(callback: (state: RoverState) => void): void {
		this._onRoverStateUpdate = callback;
	}

	/**
	 * Set lidar data update callback
	 */
	onLidarData(callback: (data: LidarData) => void): void {
		this._onLidarDataUpdate = callback;
	}

	/**
	 * Subscribe to GPS data
	 */
	private subscribeToGPS(): void {
		if (!this._socket) return;

		const subscribeMsg = {
			op: 'subscribe',
			topic: ROS2_CONFIG.TOPICS.GPS,
			type: 'sensor_msgs/NavSatFix'
		};

		this._socket.send(JSON.stringify(subscribeMsg));
	}

	/**
	 * Subscribe to IMU data (quaternions)
	 */
	private subscribeToIMUData(): void {
		if (!this._socket) return;

		const subscribeMsg = {
			op: 'subscribe',
			topic: ROS2_CONFIG.TOPICS.IMU_DATA,
			type: 'sensor_msgs/Imu'
		};

		this._socket.send(JSON.stringify(subscribeMsg));
	}

	/**
	 * Subscribe to raw IMU data
	 */
	private subscribeToIMURaw(): void {
		if (!this._socket) return;

		const subscribeMsg = {
			op: 'subscribe',
			topic: ROS2_CONFIG.TOPICS.IMU_RAW,
			type: 'std_msgs/String'
		};

		this._socket.send(JSON.stringify(subscribeMsg));
	}

	/**
	 * Subscribe to LIDAR data
	 */
	private subscribeToLidar(): void {
		if (!this._socket) return;

		const subscribeMsg = {
			op: 'subscribe',
			topic: ROS2_CONFIG.TOPICS.LIDAR,
			type: 'sensor_msgs/LaserScan'
		};

		this._socket.send(JSON.stringify(subscribeMsg));
	}

	/**
	 * Subscribe to command velocity data
	 */
	private subscribeToCmdVel(): void {
		if (!this._socket) return;

		const subscribeMsg = {
			op: 'subscribe',
			topic: ROS2_CONFIG.TOPICS.CMD_VEL,
			type: 'geometry_msgs/Twist'
		};

		this._socket.send(JSON.stringify(subscribeMsg));
	}

	/**
	 * Subscribe to legacy commands
	 */
	private subscribeToLegacyCommands(): void {
		if (!this._socket) return;

		const subscribeMsg = {
			op: 'subscribe',
			topic: ROS2_CONFIG.TOPICS.COMMAND,
			type: 'std_msgs/String'
		};

		this._socket.send(JSON.stringify(subscribeMsg));
	}

	/**
	 * Subscribe to obstacle detection
	 */
	private subscribeToObstacleDetected(): void {
		if (!this._socket) return;

		const subscribeMsg = {
			op: 'subscribe',
			topic: ROS2_CONFIG.TOPICS.OBSTACLE_DETECTED,
			type: 'std_msgs/Bool'
		};

		this._socket.send(JSON.stringify(subscribeMsg));
	}

	/**
	 * Subscribe to obstacle distance
	 */
	private subscribeToObstacleDistance(): void {
		if (!this._socket) return;

		const subscribeMsg = {
			op: 'subscribe',
			topic: ROS2_CONFIG.TOPICS.OBSTACLE_DISTANCE,
			type: 'std_msgs/Float32'
		};

		this._socket.send(JSON.stringify(subscribeMsg));
	}

	/**
	 * Subscribe to rover state updates
	 */
	private subscribeToRoverState(): void {
		if (!this._socket) return;

		const subscribeMsg = {
			op: 'subscribe',
			topic: ROS2_CONFIG.TOPICS.ROVER_STATE,
			type: 'std_msgs/String'
		};

		this._socket.send(JSON.stringify(subscribeMsg));
	}

	/**
	 * Unsubscribe from rover state updates
	 */
	private unsubscribeFromRoverState(): void {
		if (!this._socket) return;

		const unsubscribeMsg = {
			op: 'unsubscribe',
			topic: ROS2_CONFIG.TOPICS.ROVER_STATE
		};

		this._socket.send(JSON.stringify(unsubscribeMsg));
	}

	/**
	 * Unsubscribe from all topics
	 */
	private unsubscribeFromAllTopics(): void {
		if (!this._socket) return;

		const topics = [
			ROS2_CONFIG.TOPICS.ROVER_STATE,
			ROS2_CONFIG.TOPICS.GPS,
			ROS2_CONFIG.TOPICS.IMU_DATA,
			ROS2_CONFIG.TOPICS.IMU_RAW,
			ROS2_CONFIG.TOPICS.LIDAR,
			ROS2_CONFIG.TOPICS.CMD_VEL,
			ROS2_CONFIG.TOPICS.JSON_COMMANDS,
			ROS2_CONFIG.TOPICS.COMMAND,
			ROS2_CONFIG.TOPICS.OBSTACLE_DETECTED,
			ROS2_CONFIG.TOPICS.OBSTACLE_DISTANCE
		];

		topics.forEach((topic) => {
			const unsubscribeMsg = {
				op: 'unsubscribe',
				topic: topic
			};
			this._socket?.send(JSON.stringify(unsubscribeMsg));
		});
	}

	/**
	 * Start sending periodic heartbeat
	 */
	private startHeartbeat(): void {
		this.stopHeartbeat(); // Clear any existing heartbeat

		this._heartbeatInterval = setInterval(() => {
			this.sendHeartbeat();
		}, 3000); // Send heartbeat every 3 seconds

		// Send initial heartbeat
		this.sendHeartbeat();
	}

	/**
	 * Stop sending heartbeat
	 */
	private stopHeartbeat(): void {
		if (this._heartbeatInterval) {
			clearInterval(this._heartbeatInterval);
			this._heartbeatInterval = null;
		}
	}

	/**
	 * Send heartbeat to rover
	 */
	private sendHeartbeat(): void {
		if (!this._isConnected || !this._socket) return;

		const heartbeatMsg = {
			op: 'publish',
			topic: ROS2_CONFIG.TOPICS.ROVER_HEARTBEAT,
			msg: {
				data: JSON.stringify({
					rover_id: this._roverId,
					timestamp: Date.now(),
					status: 'alive'
				})
			}
		};

		this._socket.send(JSON.stringify(heartbeatMsg));
		this._lastHeartbeat = Date.now();
	}

	/**
	 * Database write functions (placeholder implementations)
	 */
	
	/**
	 * Write GPS data to database
	 */
	private async writeGPSDataToDatabase(data: GPSData): Promise<void> {
		// TODO: Implement database write for GPS data
		console.log(`[DB Placeholder] Writing GPS data for rover ${this._roverId}:`, data);
		// Example: await db.insert(gpsTable).values({ rover_id: this._roverId, ...data });
	}

	/**
	 * Write IMU data to database
	 */
	private async writeIMUDataToDatabase(data: IMUData): Promise<void> {
		// TODO: Implement database write for IMU data
		console.log(`[DB Placeholder] Writing IMU data for rover ${this._roverId}:`, data);
		// Example: await db.insert(imuTable).values({ rover_id: this._roverId, ...data });
	}

	/**
	 * Write raw IMU data to database
	 */
	private async writeIMURawDataToDatabase(data: IMURawData): Promise<void> {
		// TODO: Implement database write for raw IMU data
		console.log(`[DB Placeholder] Writing raw IMU data for rover ${this._roverId}:`, data);
		// Example: await db.insert(imuRawTable).values({ rover_id: this._roverId, ...data });
	}

	/**
	 * Write LIDAR data to database
	 */
	private async writeLidarDataToDatabase(data: LidarData): Promise<void> {
		// TODO: Implement database write for LIDAR data
		console.log(`[DB Placeholder] Writing LIDAR data for rover ${this._roverId}:`, data);
		// Example: await db.insert(lidarTable).values({ rover_id: this._roverId, ...data });
	}

	/**
	 * Write command velocity data to database
	 */
	private async writeCmdVelDataToDatabase(data: CmdVelData): Promise<void> {
		// TODO: Implement database write for command velocity data
		console.log(`[DB Placeholder] Writing CmdVel data for rover ${this._roverId}:`, data);
		// Example: await db.insert(cmdVelTable).values({ rover_id: this._roverId, ...data });
	}

	/**
	 * Write JSON commands to database
	 */
	private async writeJSONCommandsToDatabase(data: any): Promise<void> {
		// TODO: Implement database write for JSON commands
		console.log(`[DB Placeholder] Writing JSON commands for rover ${this._roverId}:`, data);
		// Example: await db.insert(jsonCommandsTable).values({ rover_id: this._roverId, command_data: JSON.stringify(data), timestamp: Date.now() });
	}

	/**
	 * Write legacy commands to database
	 */
	private async writeLegacyCommandsToDatabase(data: any): Promise<void> {
		// TODO: Implement database write for legacy commands
		console.log(`[DB Placeholder] Writing legacy commands for rover ${this._roverId}:`, data);
		// Example: await db.insert(legacyCommandsTable).values({ rover_id: this._roverId, command_data: JSON.stringify(data), timestamp: Date.now() });
	}

	/**
	 * Write obstacle data to database
	 */
	private async writeObstacleDataToDatabase(data: ObstacleData): Promise<void> {
		// TODO: Implement database write for obstacle data
		console.log(`[DB Placeholder] Writing obstacle data for rover ${this._roverId}:`, data);
		// Example: await db.insert(obstacleTable).values({ rover_id: this._roverId, ...data });
	}

	/**
	 * Handle incoming messages from ROS2
	 */
	private handleMessage(event: MessageEvent): void {
		try {
			const data = JSON.parse(event.data);

			if (!data.topic || !data.msg) return;

			switch (data.topic) {
				case ROS2_CONFIG.TOPICS.ROVER_STATE:
					this.handleRoverStateMessage(data);
					break;

				case ROS2_CONFIG.TOPICS.GPS:
					this.handleGPSMessage(data);
					break;

				case ROS2_CONFIG.TOPICS.IMU_DATA:
					this.handleIMUDataMessage(data);
					break;

				case ROS2_CONFIG.TOPICS.IMU_RAW:
					this.handleIMURawMessage(data);
					break;

				case ROS2_CONFIG.TOPICS.LIDAR:
					this.handleLidarMessage(data);
					break;

				case ROS2_CONFIG.TOPICS.CMD_VEL:
					this.handleCmdVelMessage(data);
					break;

				case ROS2_CONFIG.TOPICS.JSON_COMMANDS:
					this.handleJSONCommandsMessage(data);
					break;

				case ROS2_CONFIG.TOPICS.COMMAND:
					this.handleLegacyCommandsMessage(data);
					break;

				case ROS2_CONFIG.TOPICS.OBSTACLE_DETECTED:
					this.handleObstacleDetectedMessage(data);
					break;

				case ROS2_CONFIG.TOPICS.OBSTACLE_DISTANCE:
					this.handleObstacleDistanceMessage(data);
					break;

				default:
					console.log(`Unhandled topic: ${data.topic}`);
					break;
			}
		} catch (error) {
			console.error('Error parsing ROS2 message:', error);
		}
	}

	/**
	 * Handle rover state message
	 */
	private handleRoverStateMessage(data: any): void {
		const stateData = typeof data.msg.data === 'string' ? JSON.parse(data.msg.data) : data.msg.data;
		this._roverState = stateData.state || stateData;

		if (this._onRoverStateUpdate) {
			this._onRoverStateUpdate({
				state: this._roverState as 'idle' | 'manual_control' | 'autonomous',
				timestamp: Date.now(),
				roverId: this._roverId
			});
		}

		this.notifyStateChange();
	}

	/**
	 * Handle GPS message
	 */
	private handleGPSMessage(data: any): void {
		const gpsData: GPSData = {
			latitude: data.msg.latitude || 0,
			longitude: data.msg.longitude || 0,
			altitude: data.msg.altitude || 0,
			accuracy: data.msg.position_covariance ? Math.sqrt(data.msg.position_covariance[0]) : undefined,
			timestamp: Date.now()
		};

		this._gpsData = gpsData;
		this.writeGPSDataToDatabase(gpsData);
	}

	/**
	 * Handle IMU data message
	 */
	private handleIMUDataMessage(data: any): void {
		const imuData: IMUData = {
			orientation: {
				x: data.msg.orientation?.x || 0,
				y: data.msg.orientation?.y || 0,
				z: data.msg.orientation?.z || 0,
				w: data.msg.orientation?.w || 1
			},
			angular_velocity: {
				x: data.msg.angular_velocity?.x || 0,
				y: data.msg.angular_velocity?.y || 0,
				z: data.msg.angular_velocity?.z || 0
			},
			linear_acceleration: {
				x: data.msg.linear_acceleration?.x || 0,
				y: data.msg.linear_acceleration?.y || 0,
				z: data.msg.linear_acceleration?.z || 0
			},
			timestamp: Date.now()
		};

		this._imuData = imuData;
		this.writeIMUDataToDatabase(imuData);
	}

	/**
	 * Handle raw IMU message
	 */
	private handleIMURawMessage(data: any): void {
		try {
			const rawData = typeof data.msg.data === 'string' ? JSON.parse(data.msg.data) : data.msg.data;
			const imuRawData: IMURawData = {
				roll: rawData.roll || rawData[0] || 0,
				pitch: rawData.pitch || rawData[1] || 0,
				yaw: rawData.yaw || rawData[2] || 0,
				temperature: rawData.temperature || rawData.temp || rawData[3] || 0,
				voltage: rawData.voltage || rawData.V || rawData[4] || 0,
				timestamp: Date.now()
			};

			this._imuRawData = imuRawData;
			this.writeIMURawDataToDatabase(imuRawData);
		} catch (error) {
			console.error('Error parsing raw IMU data:', error);
		}
	}

	/**
	 * Handle LIDAR message
	 */
	private handleLidarMessage(data: any): void {
		const lidarData: LidarData = {
			ranges: data.msg.ranges || [],
			angle_min: data.msg.angle_min || 0,
			angle_max: data.msg.angle_max || 0,
			angle_increment: data.msg.angle_increment || 0,
			range_min: data.msg.range_min || 0,
			range_max: data.msg.range_max || 0,
			timestamp: Date.now()
		};

		this._lidarData = lidarData;
		this.writeLidarDataToDatabase(lidarData);
		
		// Call lidar callback if set
		if (this._onLidarDataUpdate) {
			this._onLidarDataUpdate(lidarData);
		}
	}

	/**
	 * Handle command velocity message
	 */
	private handleCmdVelMessage(data: any): void {
		const cmdVelData: CmdVelData = {
			linear: {
				x: data.msg.linear?.x || 0,
				y: data.msg.linear?.y || 0,
				z: data.msg.linear?.z || 0
			},
			angular: {
				x: data.msg.angular?.x || 0,
				y: data.msg.angular?.y || 0,
				z: data.msg.angular?.z || 0
			},
			timestamp: Date.now()
		};

		this._cmdVelData = cmdVelData;
		this.writeCmdVelDataToDatabase(cmdVelData);
	}

	/**
	 * Handle JSON commands message
	 */
	private handleJSONCommandsMessage(data: any): void {
		try {
			const commandData = typeof data.msg.data === 'string' ? JSON.parse(data.msg.data) : data.msg.data;
			this._jsonCommands = commandData;
			this.writeJSONCommandsToDatabase(commandData);
		} catch (error) {
			console.error('Error parsing JSON commands:', error);
		}
	}

	/**
	 * Handle legacy commands message
	 */
	private handleLegacyCommandsMessage(data: any): void {
		try {
			const commandData = typeof data.msg.data === 'string' ? JSON.parse(data.msg.data) : data.msg.data;
			this._legacyCommands = commandData;
			this.writeLegacyCommandsToDatabase(commandData);
		} catch (error) {
			console.error('Error parsing legacy commands:', error);
		}
	}

	/**
	 * Handle obstacle detected message
	 */
	private handleObstacleDetectedMessage(data: any): void {
		const detected = data.msg.data === true || data.msg.data === 'true';
		
		// Update or create obstacle data
		if (!this._obstacleData || this._obstacleData.detected !== detected) {
			this._obstacleData = {
				detected: detected,
				distance: this._obstacleData?.distance,
				timestamp: Date.now()
			};

			this.writeObstacleDataToDatabase(this._obstacleData);
		}
	}

	/**
	 * Handle obstacle distance message
	 */
	private handleObstacleDistanceMessage(data: any): void {
		const distance = parseFloat(data.msg.data) || 0;
		
		// Update or create obstacle data
		this._obstacleData = {
			detected: this._obstacleData?.detected || false,
			distance: distance,
			timestamp: Date.now()
		};

		this.writeObstacleDataToDatabase(this._obstacleData);
	}

	/**
	 * Notify state change callback
	 */
	private notifyStateChange(): void {
		if (this._onStateChange) {
			this._onStateChange(this.status);
		}
	}
}

/**
 * Global Command Center Manager
 * Manages multiple rover connections and provides a singleton interface
 */
class CommandCenterManager {
	private clients: Map<string, ROS2CommandCentreClient> = new Map();

	/**
	 * Get or create a command center client for a rover
	 */
	getClient(roverId: string): ROS2CommandCentreClient {
		if (!this.clients.has(roverId)) {
			this.clients.set(roverId, new ROS2CommandCentreClient(roverId));
		}
		return this.clients.get(roverId)!;
	}

	/**
	 * Disconnect all clients
	 */
	disconnectAll(): void {
		for (const client of this.clients.values()) {
			client.disconnect();
		}
		this.clients.clear();
	}

	/**
	 * Get status of all connected rovers
	 */
	getAllStatuses(): Record<string, CommandCenterStatus> {
		const statuses: Record<string, CommandCenterStatus> = {};
		for (const [roverId, client] of this.clients.entries()) {
			statuses[roverId] = client.status;
		}
		return statuses;
	}
}

// Export singleton instance
export const commandCenterManager = new CommandCenterManager();
