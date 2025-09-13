import { ROS2_CONFIG, getROSWebSocketURL, getWebRTCWebSocketURL } from '../../lib/ros2Config';

// Types
export interface LogEntry {
	time: string;
	message: string;
}

// ROS Connection config
export interface RosConfig {
	url: string;
	rosPort: number;
	commandTopic: string;
	lidarTopic: string;
	webrtcPort: number;
	obstacleDetectedTopic: string;
	obstacleDistanceTopic: string;
	gpsTopic: string;
}

// Lidar data interface
export interface LidarData {
	angle_min: number;
	angle_max: number;
	angle_increment: number;
	time_increment: number;
	scan_time: number;
	range_min: number;
	range_max: number;
	ranges: number[];
	intensities?: number[];
}

export class RoverController {
	private _isConnected: boolean = false;
	private _currentMove: string = 'Idle';
	private _connectionStatus: string = 'Disconnected';
	private _statusColor: string = 'text-red-500';
	private _logs: LogEntry[] = [];
	private _webrtc_socket: WebSocket | null = null;
	private _ros_socket: WebSocket | null = null;
	private _rosConfig: RosConfig;
	private _speed: number = 1; // Default speed setting

	// Lidar visualization properties
	private _lidarCanvas: HTMLCanvasElement | null = null;
	private _lidarContext: CanvasRenderingContext2D | null = null;
	private _lidarData: LidarData | null = null;
	private _obstacleDetected: boolean = false;
	private _obstacleDistance: number = 0;

	// Callback function for state updates
	private onStateChange: () => void;
	private _lidarHandler: ((data: any) => void) | null = null;

	constructor(onStateChange: () => void, rosConfig?: Partial<RosConfig>) {
		this.onStateChange = onStateChange;
		// Use centralized ROS2 configuration with optional overrides
		this._rosConfig = {
			url: rosConfig?.url || ROS2_CONFIG.RASPBERRY_PI_IP,
			rosPort: rosConfig?.rosPort || ROS2_CONFIG.ROS_BRIDGE_PORT,
			webrtcPort: rosConfig?.webrtcPort || ROS2_CONFIG.WEBRTC_PORT,
			commandTopic: rosConfig?.commandTopic || ROS2_CONFIG.TOPICS.COMMAND,
			lidarTopic: rosConfig?.lidarTopic || ROS2_CONFIG.TOPICS.LIDAR,
			obstacleDetectedTopic:
				rosConfig?.obstacleDetectedTopic || ROS2_CONFIG.TOPICS.OBSTACLE_DETECTED,
			obstacleDistanceTopic:
				rosConfig?.obstacleDistanceTopic || ROS2_CONFIG.TOPICS.OBSTACLE_DISTANCE,
			gpsTopic: rosConfig?.gpsTopic || ROS2_CONFIG.TOPICS.GPS
		};
	}

	// Getters
	get isConnected(): boolean {
		return this._isConnected;
	}
	get currentMove(): string {
		return this._currentMove;
	}
	get connectionStatus(): string {
		return this._connectionStatus;
	}
	get statusColor(): string {
		return this._statusColor;
	}
	get logs(): LogEntry[] {
		return this._logs;
	}
	get obstacleDetected(): boolean {
		return this._obstacleDetected;
	}
	get obstacleDistance(): number {
		return this._obstacleDistance;
	}

	// Initialize lidar visualization
	initLidarVisualization(canvasId: string): void {
		this._lidarCanvas = document.getElementById(canvasId) as HTMLCanvasElement;
		if (this._lidarCanvas) {
			this._lidarContext = this._lidarCanvas.getContext('2d');

			// Set default lidar handler to visualize data
			this._lidarHandler = (data: LidarData) => {
				this._lidarData = data;
				this.visualizeLidarData();
			};

			// Set initial canvas dimensions
			this.resizeLidarCanvas();

			// Handle window resize
			window.addEventListener('resize', () => this.resizeLidarCanvas());
		} else {
			this.addLog(`Could not find canvas with id: ${canvasId}`);
		}
	}

	// Resize canvas to match container size
	private resizeLidarCanvas(): void {
		if (!this._lidarCanvas) return;

		const container = this._lidarCanvas.parentElement;
		if (container) {
			this._lidarCanvas.width = container.clientWidth;
			this._lidarCanvas.height = container.clientHeight;

			// Redraw if we have data
			if (this._lidarData) {
				this.visualizeLidarData();
			}
		}
	}

	// Visualize lidar data on canvas
	private visualizeLidarData(): void {
		if (!this._lidarCanvas || !this._lidarContext || !this._lidarData) return;

		const ctx = this._lidarContext;
		const canvas = this._lidarCanvas;
		const lidarData = this._lidarData;

		// Clear canvas
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Calculate center coordinates (rover position)
		const centerX = canvas.width / 2;
		const centerY = canvas.height / 2;

		// Draw background
		ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Draw rover indicator
		ctx.fillStyle = 'rgba(50, 205, 50, 0.8)';
		ctx.beginPath();
		ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
		ctx.fill();

		// Draw distance rings
		// const maxRange = lidarData.range_max;
		const maxRange = 0.5; // TODO: TEMPORARY HARDCODED VALUE FOR BETTER VISUALIZATION
		// this.addLog(`LiDAR max range is: ${maxRange}`);
		const scale = Math.min(canvas.width, canvas.height) / (2.2 * maxRange);

		ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
		ctx.setLineDash([5, 5]);

		// Draw range rings at 1-meter intervals
		for (let r = 1; r <= Math.ceil(maxRange); r++) {
			ctx.beginPath();
			ctx.arc(centerX, centerY, r * scale, 0, Math.PI * 2);
			ctx.stroke();

			// Label the distance
			ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
			ctx.font = '10px Arial';
			ctx.fillText(`${r}m`, centerX + 5, centerY - r * scale + 15);
		}

		ctx.setLineDash([]);

		// Draw cardinal directions
		ctx.font = '12px Arial';
		ctx.fillStyle = 'rgba(200, 200, 200, 0.9)';
		ctx.fillText('Forward', centerX - 25, 20);
		ctx.fillText('Right', canvas.width - 30, centerY);
		ctx.fillText('Back', centerX - 15, canvas.height - 10);
		ctx.fillText('Left', 10, centerY);

		// Draw lidar points
		const { angle_min, angle_increment, ranges } = lidarData;

		for (let i = 0; i < ranges.length; i++) {
			const range = ranges[i];

			// Skip invalid readings
			if (range < lidarData.range_min || range > lidarData.range_max || isNaN(range)) {
				continue;
			}

			// Calculate angle (adjust to make forward = top of canvas)
			const angle = angle_min + i * angle_increment - Math.PI / 2 + Math.PI;

			// Calculate point coordinates
			const x = centerX + Math.cos(angle) * range * scale;
			const y = centerY + Math.sin(angle) * range * scale;

			// Color based on distance (red = close, green = far)
			const intensity = 1 - range / maxRange;
			const red = Math.floor(255 * intensity);
			const green = Math.floor(255 * (1 - intensity));

			// Draw point
			ctx.fillStyle = `rgba(${red}, ${green}, 50, 0.8)`;
			ctx.beginPath();
			ctx.arc(x, y, 2, 0, Math.PI * 2);
			ctx.fill();
		}

		// // Draw obstacle warning if detected
		// if (this._obstacleDetected) {
		//   ctx.font = 'bold 16px Arial';
		//   ctx.fillStyle = 'rgba(255, 50, 50, 0.9)';
		//   ctx.fillText(`Obstacle Detected at ${this._obstacleDistance}`, 20, 30);
		// } else {
		//   ctx.font = 'bold 16px Arial';
		//   ctx.fillStyle = 'rgba(50, 205, 50, 0.9)';
		//   ctx.fillText('No obstacles detected', 20, 30);
		// }
	}

	// Set lidar handler for external processing
	setLidarHandler(handler: (data: any) => void): void {
		this._lidarHandler = handler;
	}

	connectToRover(): Promise<void> {
		this._connectionStatus = 'Connecting...';
		this._statusColor = 'text-yellow-500';
		this.onStateChange();

		return new Promise((resolve, reject) => {
			try {
				// ROS WebSocket Connection
				const wsUrlROS = getROSWebSocketURL(this._rosConfig.url, this._rosConfig.rosPort);
				this._ros_socket = new WebSocket(wsUrlROS);

				// WebRTC WebSocket Connection
				const wsUrlWebRTC = getWebRTCWebSocketURL(this._rosConfig.url, this._rosConfig.webrtcPort);
				this._webrtc_socket = new WebSocket(wsUrlWebRTC);

				// WebRTC Socket Event Handlers
				this._webrtc_socket.onopen = () => {
					if (this._webrtc_socket) {
						this.addLog(`WebRTC connection established at ${this._webrtc_socket.url}`);
						this.startWebRTC();
					}
				};

				this._webrtc_socket.onerror = (error) => {
					this.addLog(`WebRTC connection error: ${error.type}`);
				};

				this._webrtc_socket.onclose = () => {
					this.addLog('WebRTC connection closed');
				};

				this._webrtc_socket.onmessage = (event) => {
					try {
						const data = JSON.parse(event.data);

						// Handle WebRTC signaling messages
						switch (data.type) {
							case 'answer': // Handle WebRTC answer
								this.peerConnection?.setRemoteDescription(new RTCSessionDescription(data));
								this.addLog('WebRTC answer received and applied');
								break;
							case 'ice-candidate': // Handle ICE candidates
								this.peerConnection?.addIceCandidate(new RTCIceCandidate(data.candidate));
								this.addLog('ICE candidate received and added');
								break;
							default:
								this.addLog(`Received unknown WebRTC message type: ${data.type}`);
						}
					} catch (e) {
						this.addLog(`Error parsing WebRTC message: ${e}`);
					}
				};

				// ROS Socket Event Handlers
				this._ros_socket.onopen = () => {
					// Subscribe to lidar topic
					const lidarSubscribeMsg = {
						op: 'subscribe',
						topic: this._rosConfig.lidarTopic,
						type: 'sensor_msgs/LaserScan'
					};

					// Subscribe to obstacle detection topic
					const obstacleDetectedSubscribeMsg = {
						op: 'subscribe',
						topic: this._rosConfig.obstacleDetectedTopic,
						type: 'std_msgs/Bool'
					};

					// Subscribe to obstacle distance topic
					const obstacleDistanceSubscribeMsg = {
						op: 'subscribe',
						topic: this._rosConfig.obstacleDistanceTopic,
						type: 'std_msgs/Float32'
					};

					// TODO: Subscribe to GPS data topic
					// const gpsSubscribeMsg = {
					//   op: 'subscribe',
					//   topic: this._rosConfig.obstacleDistanceTopic,
					//   type: 'std_msgs/String'
					// };

					this._ros_socket?.send(JSON.stringify(lidarSubscribeMsg));
					this._ros_socket?.send(JSON.stringify(obstacleDetectedSubscribeMsg));
					this._ros_socket?.send(JSON.stringify(obstacleDistanceSubscribeMsg));

					this._isConnected = true;
					this._connectionStatus = 'Connected';
					this._statusColor = 'text-green-500';
					this.addLog(`Connected to ROS at ${wsUrlROS}`);
					this.onStateChange();
					resolve();
				};

				this._ros_socket.onerror = (error) => {
					this._isConnected = false;
					this._connectionStatus = 'Connection failed';
					this._statusColor = 'text-red-500';
					this.addLog(`Connection error: ${error.type}`);
					this.onStateChange();
					reject(error);
				};

				this._ros_socket.onclose = () => {
					this._isConnected = false;
					this._connectionStatus = 'Disconnected';
					this._statusColor = 'text-red-500';
					this.addLog('ROS connection closed');
					this.onStateChange();
				};

				this._ros_socket.onmessage = (event) => {
					try {
						const data = JSON.parse(event.data);

						// Handle different topic messages
						if (data.topic === this._rosConfig.lidarTopic && data.msg) {
							// Handle lidar data
							if (this._lidarHandler) {
								this._lidarHandler(data.msg);
							}
						} else if (data.topic === this._rosConfig.obstacleDetectedTopic && data.msg) {
							// Update obstacle detection status
							this._obstacleDetected = data.msg.data;
							// this.addLog(`Obstacle detection status: ${this._obstacleDetected ? 'Detected' : 'Clear'}`);

							// If we have lidar data, update visualization
							if (this._lidarData) {
								this.visualizeLidarData();
							}
						} else if (data.topic === this._rosConfig.obstacleDistanceTopic && data.msg) {
							// Update obstacle distance
							this._obstacleDistance = data.msg.data;

							if (this._obstacleDetected) {
								// this.addLog(`Obstacle detected at ${this._obstacleDistance.toFixed(2)} meters`);
							}

							// If we have lidar data, update visualization
							if (this._lidarData) {
								this.visualizeLidarData();
							}
						} else if (data.topic === this._rosConfig.commandTopic) {
							// shouldn't reach this bc only sending commands to rover...
							// this.addLog(`Received command response`);
						}

						this.onStateChange();
					} catch (e) {
						this.addLog(`Error parsing message: ${e}`);
						this.onStateChange();
					}
				};
			} catch (error) {
				this._isConnected = false;
				this._connectionStatus = 'Connection failed';
				this._statusColor = 'text-red-500';
				this.addLog(`Failed to connect: ${error}`);
				this.onStateChange();
				reject(error);
			}
		});
	}

	private peerConnection: RTCPeerConnection | null = null;

	private async startWebRTC() {
		this.addLog('Starting WebRTC connection...');

		// Initialize WebRTC peer connection
		this.peerConnection = new RTCPeerConnection({
			iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }]
		});

		// Ensure the WebRTC offer requests a video stream (without adding a local camera)
		const transceiver = this.peerConnection.addTransceiver('video', { direction: 'recvonly' });

		// Handle incoming video stream
		this.peerConnection.ontrack = (event) => {
			const videoElement = document.getElementById('roverVideo') as HTMLVideoElement;
			if (videoElement) {
				videoElement.srcObject = event.streams[0];
				videoElement.play(); // Ensure playback starts
				this.addLog('WebRTC video stream received');
			}
		};

		// Handle ICE candidates
		this.peerConnection.onicecandidate = (event) => {
			if (event.candidate && this._webrtc_socket) {
				this._webrtc_socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
			}
		};

		// Create an offer and send it to the server
		const offer = await this.peerConnection.createOffer();
		await this.peerConnection.setLocalDescription(offer);

		if (this._webrtc_socket) {
			this._webrtc_socket.send(JSON.stringify({ type: 'offer', sdp: offer.sdp }));
			this.addLog('WebRTC offer sent to ROS 2 server');
		}

		// Handle answer from ROS 2
		if (this._webrtc_socket) {
			this._webrtc_socket.onmessage = (event) => {
				const message = JSON.parse(event.data);
				if (message.type === 'answer') {
					this.peerConnection?.setRemoteDescription(new RTCSessionDescription(message));
					this.addLog('WebRTC answer received and applied');
				} else if (message.type === 'ice-candidate') {
					this.peerConnection?.addIceCandidate(new RTCIceCandidate(message.candidate));
					this.addLog('ICE candidate received and added');
				}
			};
		}
	}

	disconnectFromRover(): Promise<void> {
		this._connectionStatus = 'Disconnecting...';
		this._statusColor = 'text-yellow-500';
		this.onStateChange();

		return new Promise((resolve) => {
			if (this._ros_socket && this._ros_socket.readyState === WebSocket.OPEN) {
				// Unsubscribe from topics
				const commandUnsubscribeMsg = {
					op: 'unsubscribe',
					topic: this._rosConfig.commandTopic
				};

				const lidarUnsubscribeMsg = {
					op: 'unsubscribe',
					topic: this._rosConfig.lidarTopic
				};

				const obstacleDetectedUnsubscribeMsg = {
					op: 'unsubscribe',
					topic: this._rosConfig.obstacleDetectedTopic
				};

				const obstacleDistanceUnsubscribeMsg = {
					op: 'unsubscribe',
					topic: this._rosConfig.obstacleDistanceTopic
				};

				this._ros_socket.send(JSON.stringify(commandUnsubscribeMsg));
				this._ros_socket.send(JSON.stringify(lidarUnsubscribeMsg));
				this._ros_socket.send(JSON.stringify(obstacleDetectedUnsubscribeMsg));
				this._ros_socket.send(JSON.stringify(obstacleDistanceUnsubscribeMsg));
				this._ros_socket.close();
			}

			this._isConnected = false;
			this._connectionStatus = 'Disconnected';
			this._statusColor = 'text-red-500';
			this._ros_socket = null;
			this.addLog('Disconnected from ROS');
			this.onStateChange();
			resolve();
		});
	}

	// Send command to ROS
	private publishCommand(command: string): void {
		if (!this._isConnected || !this._ros_socket) {
			this.addLog('Cannot send command: Not connected to ROS');
			return;
		}

		try {
			// Create ROS message
			const rosMessage = {
				op: 'publish',
				topic: this._rosConfig.commandTopic,
				msg: {
					data: command
				}
			};

			this._ros_socket.send(JSON.stringify(rosMessage));
			this.addLog(`Command sent: ${command}`);
		} catch (error) {
			this.addLog(`Error sending command: ${error}`);
		}

		this.onStateChange();
	}

	// Movement methods matching the provided format
	moveForward(): void {
		if (this._isConnected) {
			this._currentMove = 'Forward';
			const command = `{"T":1,"L":${0.1 * this._speed},"R":${0.1 * this._speed}}`;
			this.publishCommand(command);
		}
	}

	moveBackward(): void {
		if (this._isConnected) {
			this._currentMove = 'Backward';
			const command = `{"T":1,"L":${-0.1 * this._speed},"R":${-0.1 * this._speed}}`;
			this.publishCommand(command);
		}
	}

	moveLeft(): void {
		if (this._isConnected) {
			this._currentMove = 'Left';
			const command = `{"T":1,"L":${-0.25 * this._speed},"R":${0.25 * this._speed}}`;
			this.publishCommand(command);
		}
	}

	moveRight(): void {
		if (this._isConnected) {
			this._currentMove = 'Right';
			const command = `{"T":1,"L":${0.25 * this._speed},"R":${-0.25 * this._speed}}`;
			this.publishCommand(command);
		}
	}

	stopMovement(): void {
		if (this._isConnected) {
			this._currentMove = 'Idle';
			const command = '{"T":1,"L":0,"R":0}';
			this.publishCommand(command);
		}
	}

	// Logging
	addLog(message: string): void {
		const now = new Date();
		const timestamp = now.toLocaleTimeString();
		this._logs = [{ time: timestamp, message }, ...this._logs].slice(0, 10); // Keep only last 10 logs
	}

	// Keyboard handling
	handleKeyDown(event: KeyboardEvent): void {
		if (!this._isConnected) return;

		switch (event.key) {
			case 'w':
			case 'ArrowUp':
				this.moveForward();
				break;
			case 's':
			case 'ArrowDown':
				this.moveBackward();
				break;
			case 'a':
			case 'ArrowLeft':
				this.moveLeft();
				break;
			case 'd':
			case 'ArrowRight':
				this.moveRight();
				break;
			case ' ': // Spacebar
			case 'q':
				this.stopMovement();
				break;
		}
	}

	handleKeyUp(event: KeyboardEvent): void {
		if (!this._isConnected) return;

		// Stop movement when key is released
		if (
			['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
		) {
			this.stopMovement();
		}
	}

	// New methods to handle UI button presses
	handleButtonPress(direction: string): void {
		switch (direction) {
			case 'forward':
				this.moveForward();
				break;
			case 'backward':
				this.moveBackward();
				break;
			case 'left':
				this.moveLeft();
				break;
			case 'right':
				this.moveRight();
				break;
			default:
				this.stopMovement();
				break;
		}
	}

	handleButtonRelease(): void {
		this.stopMovement();
	}
}
