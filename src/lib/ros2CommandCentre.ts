import { ROS2_CONFIG, getROSWebSocketURL } from './ros2Config';

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

  constructor(roverId: string) {
    this._roverId = roverId;
  }

  // Getters
  get isConnected(): boolean { return this._isConnected; }
  get roverState(): string { return this._roverState; }
  get isNavigating(): boolean { return this._isNavigating; }
  get currentWaypoint(): number { return this._currentWaypoint; }
  get totalWaypoints(): number { return this._totalWaypoints; }
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
          this.subscribeToRoverState();
          
          // Start heartbeat
          this.startHeartbeat();
          
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
    
    if (this._socket) {
      // Unsubscribe from topics
      this.unsubscribeFromRoverState();
      this._socket.close();
      this._socket = null;
    }
    
    this._isConnected = false;
    this.notifyStateChange();
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
  async launchRover(waypoints: Array<{lat: number, lng: number}>): Promise<void> {
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
   * Handle incoming messages from ROS2
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      if (data.topic === ROS2_CONFIG.TOPICS.ROVER_STATE && data.msg) {
        // Handle rover state updates
        const stateData = typeof data.msg.data === 'string' ? 
          JSON.parse(data.msg.data) : data.msg.data;
        
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
    } catch (error) {
      console.error('Error parsing ROS2 message:', error);
    }
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
