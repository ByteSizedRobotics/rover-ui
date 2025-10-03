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

export interface CommandCenterStatus {
	isConnected: boolean;
	lastHeartbeat: number;
	connectionErrors: number;
	timestamp: number;
	isNavigating?: boolean;
	totalWaypoints?: number;
}

export interface WebRTCStatus {
	isConnected: boolean;
	hasRemoteStream: boolean;
	videoElementId: string | null;
}

export interface GPSData { // TODO: NATHAN Update this
	latitude: number;
	longitude: number;
	altitude: number;
	accuracy?: number;
	timestamp: number;
}

// export interface IMUData { // TODO: NATHAN Update this
// 	orientation: {
// 		x: number;
// 		y: number;
// 		z: number;
// 		w: number;
// 	};
// 	angular_velocity: {
// 		x: number;
// 		y: number;
// 		z: number;
// 	};
// 	linear_acceleration: {
// 		x: number;
// 		y: number;
// 		z: number;
// 	};
// 	timestamp: number;
// }

export interface IMURawData { // TODO: NATHAN Update this
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

export interface NodeStatus {
	timestamp: number;
	nodes: {
		gps?: string;
		csi_camera_1?: string;
		obstacle_detection?: string;
		manual_control?: string;
		motor_control?: string;
		[key: string]: string | undefined;
	};
}

export class ROS2CommandCentreClient {
	private _socket: WebSocket | null = null;
	private _isConnected: boolean = false;
	private _roverId: string;
	private _heartbeatInterval: NodeJS.Timeout | null = null;
	private _lastHeartbeat: number = 0;
	private _heartbeatErrors: number = 0;
	private _connectionErrors: number = 0;
	private _timestamp: number = Date.now();
	private _lastTimestampDbWrite: number = 0;
	private _isNavigating: boolean = false;
	private _totalWaypoints: number = 0;
	private _onStateChange: ((status: CommandCenterStatus) => void) | null = null;
	private _onTimestampUpdate: ((state: number) => void) | null = null;
	private _onLidarDataUpdate: ((data: LidarData) => void) | null = null;
	private _onNodeStatusUpdate: ((status: NodeStatus) => void) | null = null;
	private _webRTCStatusListeners: Set<(status: WebRTCStatus) => void> = new Set();

	// WebRTC camera stream properties
	private _webrtcSocket: WebSocket | null = null;
	private _peerConnection: RTCPeerConnection | null = null;
	private _isWebRTCConnected: boolean = false;
	private _remoteStream: MediaStream | null = null; // store last received remote stream
	private _currentVideoElementId: string | null = null; // currently bound video element id
	private _autoStartWebRTC: boolean = true;

	// Topic data storage
	private _gpsData: GPSData | null = null;
	// private _imuData: IMUData | null = null;
	private _imuRawData: IMURawData | null = null;
	private _lidarData: LidarData | null = null;
	private _cmdVelData: CmdVelData | null = null;
	private _jsonCommands: any | null = null;
	private _legacyCommands: any | null = null;
	private _obstacleData: ObstacleData | null = null;
	private _nodeStatus: NodeStatus | null = null;

	constructor(roverId: string) {
		this._roverId = roverId;
	}

	// Getters
	get isConnected(): boolean {
		return this._isConnected;
	}
	get timestamp(): number {
		return this._timestamp;
	}
	get isNavigating(): boolean {
		return this._isNavigating;
	}
	// get currentWaypoint(): number {
	// 	return this._currentWaypoint;
	// }
	get totalWaypoints(): number {
		return this._totalWaypoints;
	}
	get gpsData(): GPSData | null {
		return this._gpsData;
	}
	// get imuData(): IMUData | null {
	// 	return this._imuData;
	// }
	get imuRawData(): IMURawData | null {
		return this._imuRawData;
	}
	get lidarData(): LidarData | null {
		return this._lidarData;
	}
	// get cmdVelData(): CmdVelData | null {
	// 	return this._cmdVelData;
	// }
	get jsonCommands(): any | null {
		return this._jsonCommands;
	}
	// get legacyCommands(): any | null {
	// 	return this._legacyCommands;
	// }
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
	get nodeStatus(): NodeStatus | null {
		return this._nodeStatus;
	}
	get status(): CommandCenterStatus {
		return {
			isConnected: this._isConnected,
			lastHeartbeat: this._lastHeartbeat,
			connectionErrors: this._connectionErrors,
			timestamp: this._timestamp,
			isNavigating: this._isNavigating,
			totalWaypoints: this._totalWaypoints
		};
	}

	/**
	 * Connect to the ROS2 Command Center
	 */
	async connect(options: { enableVideo?: boolean } = {}): Promise<void> {
		const { enableVideo = true } = options;
		this._autoStartWebRTC = enableVideo;
		if (!enableVideo) {
			this.disconnectWebRTC();
		}

		// Check if already connected with valid socket
		if (this._isConnected && this._socket?.readyState === WebSocket.OPEN) {
			console.log(`Already connected to ROS2 Command Center for rover ${this._roverId}`);
			if (enableVideo && !this._isWebRTCConnected) {
				this.connectWebRTC();
			}
			return;
		}

		// Clean up any existing socket before reconnecting
		if (this._socket) {
			console.log(`Cleaning up existing socket before reconnecting for rover ${this._roverId}`);
			this._socket.onclose = null;
			this._socket.onerror = null;
			this._socket.onmessage = null;
			this._socket.onopen = null;
			if (this._socket.readyState === WebSocket.OPEN || this._socket.readyState === WebSocket.CONNECTING) {
				this._socket.close();
			}
			this._socket = null;
		}

		// Ensure clean state
		this._isConnected = false;

		return new Promise((resolve, reject) => {
			try {
				const wsUrl = getROSWebSocketURL();
				this._socket = new WebSocket(wsUrl);

				this._socket.onopen = () => {
					this._isConnected = true;
					this._connectionErrors = 0;
					// console.log(`Connected to ROS2 Command Center for rover ${this._roverId}`);

					// Subscribe to timestamp updates
					this.subscribeToTimestamp();

					// Subscribe to all sensor and command topics
					this.subscribeToGPS();
					// this.subscribeToIMUData();
					this.subscribeToIMURaw();
					this.subscribeToLidar();
					// this.subscribeToCmdVel();
					// this.subscribeToLegacyCommands();
					this.subscribeToObstacleDetected();
					this.subscribeToObstacleDistance();
					this.subscribeToNodeStatus();

					// Start heartbeat
					this.startHeartbeat();

					// Start periodic logging
					this.startPeriodicLogging();

					// Initialize WebRTC connection for camera stream if enabled
					if (this._autoStartWebRTC) {
						this.connectWebRTC();
					} else {
						this.setWebRTCConnected(false);
					}

					this.notifyStateChange();
					resolve();
				};

				this._socket.onerror = (error) => {
					this._connectionErrors++;
					this._isConnected = false;
					console.error(`ROS2 Command Center connection error for rover ${this._roverId}:`, error);
					
					// Clean up socket and stop heartbeat
					this.stopHeartbeat();
					if (this._socket) {
						this._socket.onclose = null;  // Prevent onclose from firing after error
						this._socket.onerror = null;
						this._socket.onmessage = null;
						this._socket.onopen = null;
					}
					
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
		// Track if state actually changed to prevent duplicate notifications
		const wasConnected = this._isConnected;
		
		// Set disconnected state FIRST
		this._isConnected = false;
		
		this.stopHeartbeat();
		this.disconnectWebRTC();
		this.stopPeriodicLogging();

		if (this._socket) {
			// Remove event handlers to prevent them from firing during close
			this._socket.onclose = null;
			this._socket.onerror = null;
			this._socket.onmessage = null;
			this._socket.onopen = null;
			
			// Unsubscribe from all topics
			this.unsubscribeFromAllTopics();
			
			// Close the socket
			if (this._socket.readyState === WebSocket.OPEN || this._socket.readyState === WebSocket.CONNECTING) {
				this._socket.close();
			}
			this._socket = null;
		}

		// Only notify if state actually changed
		if (wasConnected) {
			console.log(`Disconnected from ROS2 Command Center for rover ${this._roverId}`);
			this.notifyStateChange();
		}
	}

	private setWebRTCConnected(isConnected: boolean): void {
		if (this._isWebRTCConnected !== isConnected) {
			this._isWebRTCConnected = isConnected;
			this.emitWebRTCStatus();
		} else {
			// Still emit so listeners can react to other status changes
			this.emitWebRTCStatus();
		}
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
				this.setWebRTCConnected(false);
			};

			this._webrtcSocket.onclose = () => {
				console.log(`WebRTC connection closed for rover ${this._roverId}`);
				this.setWebRTCConnected(false);
			};

			this._webrtcSocket.onmessage = (event) => {
				this.handleWebRTCMessage(event);
			};
		} catch (error) {
			console.error(`Failed to connect WebRTC for rover ${this._roverId}:`, error);
			this.setWebRTCConnected(false);
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

		this._remoteStream = null;
		this.setWebRTCConnected(false);
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
				this._remoteStream = event.streams[0];
				this.emitWebRTCStatus();
				// If a video element has already been registered, apply immediately
				if (this._currentVideoElementId) {
					this.applyStreamToVideo();
				}
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

			this.setWebRTCConnected(true);
		} catch (error) {
			console.error(`Error starting WebRTC for rover ${this._roverId}:`, error);
			this.setWebRTCConnected(false);
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
	 * This will wait for WebRTC to be ready and retry binding if needed
	 */
	public setVideoElement(videoElementId: string | null): void {
		const previousElementId = this._currentVideoElementId;
		this._currentVideoElementId = videoElementId;
		console.log(`Setting video element '${videoElementId ?? 'none'}' for rover ${this._roverId}`);

		if (!videoElementId) {
			if (previousElementId) {
				const previousElement = document.getElementById(previousElementId) as HTMLVideoElement | null;
				if (previousElement) {
					previousElement.pause();
					previousElement.srcObject = null;
				}
			}
			this.emitWebRTCStatus();
			return;
		}

		this.emitWebRTCStatus();

		// If we already have a remote stream, try to apply immediately
		if (this._remoteStream) {
			console.log(`Remote stream already available, applying to '${videoElementId}'`);
			this.applyStreamToVideo();
		} else if (!this._peerConnection) {
			// WebRTC not ready yet, wait for it with timeout
			console.log(`WebRTC not ready yet for rover ${this._roverId}, waiting...`);
			this.waitForWebRTCAndApply();
		} else {
			// Peer connection exists but no stream yet - will apply when ontrack fires
			console.log(`Peer connection ready, waiting for stream for rover ${this._roverId}`);
		}
	}

	/**
	 * Wait for WebRTC connection to be ready, then apply stream
	 */
	private waitForWebRTCAndApply(retries = 0, maxRetries = 50): void {
		if (retries >= maxRetries) {
			console.error(`WebRTC failed to initialize after ${maxRetries} retries for rover ${this._roverId}`);
			return;
		}

		if (this._remoteStream && this._currentVideoElementId) {
			console.log(`WebRTC ready after ${retries} retries, applying stream`);
			this.applyStreamToVideo();
		} else {
			// Retry after 100ms
			setTimeout(() => this.waitForWebRTCAndApply(retries + 1, maxRetries), 100);
		}
	}

	/**
	 * Apply currently stored remote stream to the registered video element
	 */
	private applyStreamToVideo(): void {
		const elementId = this._currentVideoElementId;
		if (!elementId || !this._remoteStream) {
			console.warn(`Cannot apply stream: elementId=${elementId}, hasStream=${!!this._remoteStream}`);
			return;
		}

		const videoElement = document.getElementById(elementId) as HTMLVideoElement | null;
		if (!videoElement) {
			console.error(`Video element with id '${elementId}' not found for rover ${this._roverId}`);
			// Retry after a delay in case the element isn't in DOM yet
			setTimeout(() => {
				const retryElement = elementId ? (document.getElementById(elementId) as HTMLVideoElement | null) : null;
				if (retryElement && this._remoteStream) {
					console.log(`Video element found on retry, applying stream`);
					retryElement.srcObject = this._remoteStream;
					retryElement.play().catch(e => console.error(`Error playing video:`, e));
				}
			}, 500);
			return;
		}

		console.log(`Applying WebRTC stream to video element '${elementId}' for rover ${this._roverId}`);
		
		// Set the stream
		if (videoElement.srcObject !== this._remoteStream) {
			videoElement.srcObject = this._remoteStream;
			console.log(`Stream source set for video element`);
		}
		this.emitWebRTCStatus();

		// Try to play the video
		videoElement.play()
			.then(() => {
				console.log(`✅ WebRTC video stream successfully playing on '${this._currentVideoElementId}' for rover ${this._roverId}`);
				this.emitWebRTCStatus();
			})
			.catch(e => {
				console.error(`❌ Error playing video for rover ${this._roverId}:`, e);
				// Try unmuting if autoplay was blocked
				videoElement.muted = true;
				videoElement.play().catch(e2 => {
					console.error(`Failed to play even when muted:`, e2);
				});
			});
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

		console.log('Waiting for required nodes to start up...');
		
		// Wait for required nodes to be running (based on Python autonomous_nodes) 'imu'
		const requiredNodes = ['gps', 'csi_camera_1', 'obstacle_detection', 'motor_control'];
		const nodesStarted = await this.waitForNodesRunning(requiredNodes, 45000); // 45 second timeout
		
		if (!nodesStarted) {
			console.error('Failed to start all required nodes for autonomous navigation');
			this._isNavigating = false;
			this.notifyStateChange();
			throw new Error('Required nodes failed to start for autonomous navigation');
		}

		console.log('All required nodes are running, sending waypoints...');

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

		console.log('Rover launch completed successfully');
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

		console.log('Waiting for manual control nodes to start up...');
		
		// Wait for required nodes to be running (based on Python manual_control_nodes)
		const requiredNodes = ['manual_control', 'motor_control', 'gps', 'obstacle_detection', 'csi_camera_1'];
		const nodesStarted = await this.waitForNodesRunning(requiredNodes, 45000); // 45 second timeout
		
		if (!nodesStarted) {
			console.error('Failed to start all required nodes for manual control');
			throw new Error('Required nodes failed to start for manual control');
		}

		console.log('Manual control setup completed successfully');
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
		this._totalWaypoints = 0;
		this.notifyStateChange();
	}

	/**
	 * Set state change callback
	 */
	onStateChange(callback: ((status: CommandCenterStatus) => void) | null): void {
		this._onStateChange = callback;
	}

	/**
	 * Set rover state update callback
	 */
	onTimestampUpdate(callback: ((state: number) => void) | null): void {
		this._onTimestampUpdate = callback;
	}

	/**
	 * Set lidar data update callback
	 */
	onLidarData(callback: ((data: LidarData) => void) | null): void {
		this._onLidarDataUpdate = callback;
	}

	/**
	 * Set node status update callback
	 */
	onNodeStatusUpdate(callback: ((status: NodeStatus) => void) | null): void {
		this._onNodeStatusUpdate = callback;
	}

	/**
	 * Subscribe to WebRTC status updates (connection + stream availability)
	 * Returns a cleanup function to remove the listener
	 */
	onWebRTCStatusChange(callback: (status: WebRTCStatus) => void): () => void {
		this._webRTCStatusListeners.add(callback);
		callback(this.getWebRTCStatus());
		return () => {
			this._webRTCStatusListeners.delete(callback);
		};
	}

	private getWebRTCStatus(): WebRTCStatus {
		return {
			isConnected: this._isWebRTCConnected,
			hasRemoteStream: !!this._remoteStream,
			videoElementId: this._currentVideoElementId
		};
	}

	private emitWebRTCStatus(): void {
		const status = this.getWebRTCStatus();
		for (const listener of this._webRTCStatusListeners) {
			listener(status);
		}
	}

	/**
	 * Wait for specified nodes to reach running state
	 */
	private async waitForNodesRunning(requiredNodes: string[], timeoutMs: number = 30000): Promise<boolean> {
		return new Promise((resolve) => {
			const startTime = Date.now();
			
			const checkNodes = () => {
				if (!this._nodeStatus) {
					// No status received yet, keep waiting
					if (Date.now() - startTime < timeoutMs) {
						setTimeout(checkNodes, 1000);
						return;
					} else {
						console.warn(`Timeout waiting for node status after ${timeoutMs}ms`);
						resolve(false);
						return;
					}
				}

				// Check if all required nodes are running
				const runningNodes = requiredNodes.filter(node => 
					this._nodeStatus?.nodes[node] === 'running'
				);
				
				const errorNodes = requiredNodes.filter(node => 
					this._nodeStatus?.nodes[node] === 'error'
				);

				console.log(`Node status check: ${runningNodes.length}/${requiredNodes.length} running, ${errorNodes.length} errors`);

				if (runningNodes.length === requiredNodes.length) {
					console.log('All required nodes are running');
					resolve(true);
				} else if (errorNodes.length > 0) {
					console.warn(`Nodes in error state: ${errorNodes.join(', ')}`);
					resolve(false);
				} else if (Date.now() - startTime < timeoutMs) {
					// Keep waiting
					setTimeout(checkNodes, 1000);
				} else {
					console.warn(`Timeout waiting for nodes: ${requiredNodes.filter(node => this._nodeStatus?.nodes[node] !== 'running').join(', ')}`);
					resolve(false);
				}
			};

			// Start checking immediately
			checkNodes();
		});
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
	// private subscribeToIMUData(): void {
	// 	if (!this._socket) return;

	// 	const subscribeMsg = {
	// 		op: 'subscribe',
	// 		topic: ROS2_CONFIG.TOPICS.IMU_DATA,
	// 		type: 'sensor_msgs/Imu'
	// 	};

	// 	this._socket.send(JSON.stringify(subscribeMsg));
	// }

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
	 * Subscribe to node status updates
	 */
	private subscribeToNodeStatus(): void {
		if (!this._socket) return;

		const subscribeMsg = {
			op: 'subscribe',
			topic: ROS2_CONFIG.TOPICS.NODE_STATUS,
			type: 'std_msgs/String'
		};

		this._socket.send(JSON.stringify(subscribeMsg));
	}

	/**
	 * Subscribe to rover state updates
	 */
	private subscribeToTimestamp(): void {
		if (!this._socket) return;

		const subscribeMsg = {
			op: 'subscribe',
			topic: ROS2_CONFIG.TOPICS.TIMESTAMP,
			type: 'std_msgs/String'
		};

		this._socket.send(JSON.stringify(subscribeMsg));
	}

	/**
	 * Unsubscribe from rover state updates
	 */
	// private unsubscribeFromRoverState(): void {
	// 	if (!this._socket) return;

	// 	const unsubscribeMsg = {
	// 		op: 'unsubscribe',
	// 		topic: ROS2_CONFIG.TOPICS.ROVER_STATE
	// 	};

	// 	this._socket.send(JSON.stringify(unsubscribeMsg));
	// }

	/**
	 * Unsubscribe from all topics
	 */
	private unsubscribeFromAllTopics(): void {
		if (!this._socket) return;

		const topics = [
			// ROS2_CONFIG.TOPICS.ROVER_STATE,
			ROS2_CONFIG.TOPICS.GPS,
			// ROS2_CONFIG.TOPICS.IMU_DATA,
			ROS2_CONFIG.TOPICS.IMU_RAW,
			ROS2_CONFIG.TOPICS.LIDAR,
			ROS2_CONFIG.TOPICS.OBSTACLE_DETECTED,
			ROS2_CONFIG.TOPICS.OBSTACLE_DISTANCE,
			ROS2_CONFIG.TOPICS.TIMESTAMP,
			ROS2_CONFIG.TOPICS.NODE_STATUS
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

		console.log(`[Heartbeat] Starting heartbeat for rover ${this._roverId}`);
		
		this._heartbeatInterval = setInterval(() => {
			this.sendHeartbeat();
		}, 3000); // Send heartbeat every 3 seconds

		// Send initial heartbeat immediately
		this.sendHeartbeat();
	}

	/**
	 * Stop sending heartbeat
	 */
	private stopHeartbeat(): void {
		if (this._heartbeatInterval) {
			console.log(`[Heartbeat] Stopping heartbeat for rover ${this._roverId}`);
			clearInterval(this._heartbeatInterval);
			this._heartbeatInterval = null;
		}
	}

	/**
	 * Send heartbeat to rover
	 */
	private sendHeartbeat(): void {
		// Check connection status
		if (!this._isConnected || !this._socket) {
			console.warn(`[Heartbeat] Cannot send heartbeat for rover ${this._roverId}: Not connected (socket=${!!this._socket}, connected=${this._isConnected})`);
			return;
		}

		// Check if socket is in OPEN state
		if (this._socket.readyState !== WebSocket.OPEN) {
			console.warn(`[Heartbeat] Cannot send heartbeat for rover ${this._roverId}: WebSocket not ready (state=${this._socket.readyState})`);
			return;
		}

		try {
			const heartbeatMsg = {
				op: 'publish',
				topic: ROS2_CONFIG.TOPICS.ROVER_HEARTBEAT,
				msg: {
					data: JSON.stringify({
						rover_id: this._roverId,
						timestamp: Date.now(),
						status: 'alive',
						is_navigating: this._isNavigating
					})
				}
			};

			this._socket.send(JSON.stringify(heartbeatMsg));
			this._lastHeartbeat = Date.now();
			this._heartbeatErrors = 0; // Reset error count on success
			
			console.log(`[Heartbeat] ✓ Sent heartbeat for rover ${this._roverId} (navigating=${this._isNavigating})`);
		} catch (error) {
			this._heartbeatErrors++;
			console.error(`[Heartbeat] ✗ Failed to send heartbeat for rover ${this._roverId} (error #${this._heartbeatErrors}):`, error);
			
			// If too many errors, stop the heartbeat to prevent spam
			if (this._heartbeatErrors >= 5) {
				console.error(`[Heartbeat] Too many heartbeat errors (${this._heartbeatErrors}), stopping heartbeat for rover ${this._roverId}`);
				this.stopHeartbeat();
			}
		}
	}

	/**
	 * Send log entry to API every 15 seconds if data is available
	 */
	private async sendLogToApi(): Promise<void> {
		if (!this._gpsData || !this._imuRawData) {
			console.warn(`[Log] Missing GPS or IMU data, not sending log for rover ${this._roverId}`);
			return;
		}
		try {
			const payload = {
				latitude: this._gpsData.latitude,
				longitude: this._gpsData.longitude,
				altitude: this._gpsData.altitude,
				roll: this._imuRawData.roll,
				pitch: this._imuRawData.pitch,
				yaw: this._imuRawData.yaw,
				temperature: this._imuRawData.temperature,
				voltage: this._imuRawData.voltage
			};
			const res = await fetch(`/api/rovers/${this._roverId}/logs`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!res.ok) {
				console.error(`[Log] Failed to send log for rover ${this._roverId}:`, await res.text());
			} else {
				console.log(`[Log] Log entry sent for rover ${this._roverId}`);
			}
		} catch (err) {
			console.error(`[Log] Error sending log for rover ${this._roverId}:`, err);
		}
	}

	private _logInterval: NodeJS.Timeout | null = null;

	/**
	 * Start periodic logging to API every 15 seconds
	 */
	public startPeriodicLogging(): void {
		if (this._logInterval) return;
		this._logInterval = setInterval(() => {
			this.sendLogToApi();
		}, 15000);
		// Optionally send one immediately
		this.sendLogToApi();
	}

	/**
	 * Stop periodic logging
	 */
	public stopPeriodicLogging(): void {
		if (this._logInterval) {
			clearInterval(this._logInterval);
			this._logInterval = null;
		}
	}

	/**
	 * Database update functions
	 */
	private async writeTimestampToDatabase(timestamp: number): Promise<void> {
		console.log(`[DB Placeholder] Writing timestamp for rover ${this._roverId}:`, timestamp);
	}

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
	// private async writeIMUDataToDatabase(data: IMUData): Promise<void> {
	// 	// TODO: Implement database write for IMU data
	// 	console.log(`[DB Placeholder] Writing IMU data for rover ${this._roverId}:`, data);
	// 	// Example: await db.insert(imuTable).values({ rover_id: this._roverId, ...data });
	// }

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
		//console.log(`[DB Placeholder] Writing LIDAR data for rover ${this._roverId}:`, data);
		// Example: await db.insert(lidarTable).values({ rover_id: this._roverId, ...data });
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
				case ROS2_CONFIG.TOPICS.TIMESTAMP:
					this.handleTimestampMessage(data);
					break;

				case ROS2_CONFIG.TOPICS.NODE_STATUS:
					this.handleNodeStatusMessage(data);
					break;

				case ROS2_CONFIG.TOPICS.GPS:
					this.handleGPSMessage(data);
					break;

				// case ROS2_CONFIG.TOPICS.IMU_DATA:
				// 	this.handleIMUDataMessage(data);
				// 	break;

				case ROS2_CONFIG.TOPICS.IMU_RAW:
					this.handleIMURawMessage(data);
					break;

				case ROS2_CONFIG.TOPICS.LIDAR:
					this.handleLidarMessage(data);
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
	 * Handle timestamp message from rover
	 */
	private handleTimestampMessage(data: any): void {
		try {
			const timestampData = typeof data.msg.data === 'string' ? JSON.parse(data.msg.data) : data.msg.data;
			
			// Update the timestamp from the rover
			this._timestamp = timestampData.timestamp || timestampData || Date.now();
			
			// Check if 15 seconds have passed since last database write
			const now = Date.now();
			const timeSinceLastWrite = now - this._lastTimestampDbWrite;
			const fifteenSeconds = 15 * 1000; // 15 seconds in milliseconds
			
			if (timeSinceLastWrite >= fifteenSeconds) {
				// Create log entry
				// this.writeTimestampToDatabase(this._timestamp);
				
				this._lastTimestampDbWrite = now;
			}

			// Call timestamp update callback if set
			if (this._onTimestampUpdate) {
				this._onTimestampUpdate(this._timestamp);
			}

			this.notifyStateChange();
		} catch (error) {
			console.error('Error parsing timestamp data:', error);
		}
	}

	/**
	 * Handle node status message from rover
	 */
	private handleNodeStatusMessage(data: any): void {
		try {
			const statusData = typeof data.msg.data === 'string' ? JSON.parse(data.msg.data) : data.msg.data;
			
			// Update the node status from the rover
			this._nodeStatus = {
				timestamp: statusData.timestamp || Date.now(),
				nodes: statusData.nodes || {}
			};

			// Log detailed node status information
			console.log(`===== Node Status Update for Rover ${this._roverId} =====`);
			console.log(`Timestamp: ${new Date(this._nodeStatus.timestamp * 1000).toISOString()}`);
			console.log('Node Status Details:');
			
			// Log each node's status with color coding for better visibility
			Object.entries(this._nodeStatus.nodes).forEach(([nodeName, status]) => {
				const statusIcon = this.getStatusIcon(status);
				console.log(`  ${statusIcon} ${nodeName}: ${status}`);
			});

			// Summary counts
			const statusCounts = this.getNodeStatusCounts(this._nodeStatus.nodes);
			console.log(`Summary: ${statusCounts.running} running, ${statusCounts.offline} offline, ${statusCounts.starting} starting, ${statusCounts.stopping} stopping, ${statusCounts.error} error`);
			console.log('===============================================');

			// Call node status update callback if set
			if (this._onNodeStatusUpdate) {
				this._onNodeStatusUpdate(this._nodeStatus);
			}

			this.notifyStateChange();
		} catch (error) {
			console.error('Error parsing node status data:', error);
		}
	}

	/**
	 * Get status icon for visual representation in logs
	 */
	private getStatusIcon(status: string | undefined): string {
		switch (status) {
			case 'running':
				return '✅';
			case 'offline':
				return '⚫';
			case 'starting':
				return '🟡';
			case 'stopping':
				return '🟠';
			case 'error':
				return '❌';
			default:
				return '❓';
		}
	}

	/**
	 * Get counts of nodes by status for summary logging
	 */
	private getNodeStatusCounts(nodes: { [key: string]: string | undefined }): {
		running: number;
		offline: number;
		starting: number;
		stopping: number;
		error: number;
		unknown: number;
	} {
		const counts = {
			running: 0,
			offline: 0,
			starting: 0,
			stopping: 0,
			error: 0,
			unknown: 0
		};

		Object.values(nodes).forEach(status => {
			switch (status) {
				case 'running':
					counts.running++;
					break;
				case 'offline':
					counts.offline++;
					break;
				case 'starting':
					counts.starting++;
					break;
				case 'stopping':
					counts.stopping++;
					break;
				case 'error':
					counts.error++;
					break;
				default:
					counts.unknown++;
					break;
			}
		});

		return counts;
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
	// private handleIMUDataMessage(data: any): void {
	// 	const imuData: IMUData = {
	// 		orientation: {
	// 			x: data.msg.orientation?.x || 0,
	// 			y: data.msg.orientation?.y || 0,
	// 			z: data.msg.orientation?.z || 0,
	// 			w: data.msg.orientation?.w || 1
	// 		},
	// 		angular_velocity: {
	// 			x: data.msg.angular_velocity?.x || 0,
	// 			y: data.msg.angular_velocity?.y || 0,
	// 			z: data.msg.angular_velocity?.z || 0
	// 		},
	// 		linear_acceleration: {
	// 			x: data.msg.linear_acceleration?.x || 0,
	// 			y: data.msg.linear_acceleration?.y || 0,
	// 			z: data.msg.linear_acceleration?.z || 0
	// 		},
	// 		timestamp: Date.now()
	// 	};

	// 	this._imuData = imuData;
	// 	this.writeIMUDataToDatabase(imuData);
	// }

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
