import { ROS2_CONFIG, getROSWebSocketURL } from '../../../lib/ros2Config';
import type { LidarData } from '$lib/ros2CommandCentre';

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
}

export class RoverController {
	private _isConnected: boolean = false;
	private _currentMove: string = 'Idle';
	private _connectionStatus: string = 'Disconnected';
	private _statusColor: string = 'text-red-500';
	private _logs: LogEntry[] = [];
	private _ros_socket: WebSocket | null = null;
	private _rosConfig: RosConfig;
	private _speed: number = 1; // Default speed setting

	// Callback function for state updates
	private onStateChange: () => void;

	constructor(onStateChange: () => void, rosConfig?: Partial<RosConfig>) {
		this.onStateChange = onStateChange;
		// Use centralized ROS2 configuration with optional overrides
		this._rosConfig = {
			url: rosConfig?.url || ROS2_CONFIG.RASPBERRY_PI_IP,
			rosPort: rosConfig?.rosPort || ROS2_CONFIG.ROS_BRIDGE_PORT,
			commandTopic: rosConfig?.commandTopic || ROS2_CONFIG.TOPICS.MOTOR_MANUAL_JSON_COMMAND
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



	connectToRover(): Promise<void> {
		this._connectionStatus = 'Connecting...';
		this._statusColor = 'text-yellow-500';
		this.onStateChange();

		return new Promise((resolve, reject) => {
			try {
				// ROS WebSocket Connection (for motor commands only)
				const wsUrlROS = getROSWebSocketURL(this._rosConfig.url, this._rosConfig.rosPort);
				this._ros_socket = new WebSocket(wsUrlROS);

				// ROS Socket Event Handlers
				this._ros_socket.onopen = () => {
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
					// Handle ROS messages if needed (currently just for command responses)
					// Most sensor data now comes through ROS2CommandCentreClient
					this.onStateChange();
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

	disconnectFromRover(): Promise<void> {
		this._connectionStatus = 'Disconnecting...';
		this._statusColor = 'text-yellow-500';
		this.onStateChange();

		return new Promise((resolve) => {
			if (this._ros_socket && this._ros_socket.readyState === WebSocket.OPEN) {
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
