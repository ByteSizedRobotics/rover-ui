import { ROS2_CONFIG, getROSWebSocketURL } from '../../../lib/ros2Config';
TODO: NATHAN DELETE THIS
// Types for navigation
export interface Waypoint {
  lat: number;
  lng: number;
}

export interface NavigationStatus {
  isConnected: boolean;
  isNavigating: boolean;
  currentWaypoint: number;
  totalWaypoints: number;
  status: string;
  error?: string;
}

// Extended ROS config for navigation
export interface NavigationRosConfig {
  url: string;
  rosPort: number;
  waypointTopic: string;
  navigationStatusTopic: string;
  goalTopic: string;
  pathTopic: string;
}

export class NavigationController {
  private _rosSocket: WebSocket | null = null;
  private _isConnected: boolean = false;
  private _isNavigating: boolean = false;
  private _currentWaypoint: number = 0;
  private _totalWaypoints: number = 0;
  private _status: string = "Disconnected";
  private _error?: string;
  private _rosConfig: NavigationRosConfig;
  private onStateChange: () => void;

  constructor(
    onStateChange: () => void, 
    rosConfig?: Partial<NavigationRosConfig>
  ) {
    this.onStateChange = onStateChange;
    this._rosConfig = {
      url: rosConfig?.url || ROS2_CONFIG.RASPBERRY_PI_IP,
      rosPort: rosConfig?.rosPort || ROS2_CONFIG.ROS_BRIDGE_PORT,
      waypointTopic: rosConfig?.waypointTopic || ROS2_CONFIG.TOPICS.WAYPOINTS,
      navigationStatusTopic: rosConfig?.navigationStatusTopic || ROS2_CONFIG.TOPICS.NAVIGATION_STATUS,
      goalTopic: rosConfig?.goalTopic || ROS2_CONFIG.TOPICS.GOAL,
      pathTopic: rosConfig?.pathTopic || ROS2_CONFIG.TOPICS.PATH
    };
  }

  // Getters
  get isConnected(): boolean { return this._isConnected; }
  get isNavigating(): boolean { return this._isNavigating; }
  get currentWaypoint(): number { return this._currentWaypoint; }
  get totalWaypoints(): number { return this._totalWaypoints; }
  get status(): string { return this._status; }
  get error(): string | undefined { return this._error; }

  // Connect to ROS2 bridge
  async connectToROS(): Promise<void> {
    this._status = "Connecting...";
    this._error = undefined;
    this.onStateChange();

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = getROSWebSocketURL(this._rosConfig.url, this._rosConfig.rosPort);
        this._rosSocket = new WebSocket(wsUrl);

        this._rosSocket.onopen = () => {
          this._isConnected = true;
          this._status = "Connected";
          this._error = undefined;
          
          // Subscribe to navigation status topic
          this.subscribeToNavigationStatus();
          
          this.onStateChange();
          resolve();
        };

        this._rosSocket.onerror = (error) => {
          this._isConnected = false;
          this._status = "Connection failed";
          this._error = `Failed to connect to ROS2 bridge at ${wsUrl}`;
          this.onStateChange();
          reject(new Error(this._error));
        };

        this._rosSocket.onclose = () => {
          this._isConnected = false;
          this._status = "Disconnected";
          this._isNavigating = false;
          this.onStateChange();
        };

        this._rosSocket.onmessage = (event) => {
          this.handleROSMessage(event);
        };

      } catch (error) {
        this._isConnected = false;
        this._status = "Connection failed";
        this._error = error instanceof Error ? error.message : "Unknown error";
        this.onStateChange();
        reject(error);
      }
    });
  }

  // Subscribe to navigation status updates
  private subscribeToNavigationStatus(): void {
    if (!this._rosSocket || this._rosSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    const subscribeMsg = {
      op: 'subscribe',
      topic: this._rosConfig.navigationStatusTopic,
      type: 'std_msgs/String' // Adjust type based on your ROS2 message type
    };

    this._rosSocket.send(JSON.stringify(subscribeMsg));
  }

  // Handle incoming ROS messages
  private handleROSMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      if (data.topic === this._rosConfig.navigationStatusTopic && data.msg) {
        // Parse navigation status message
        const statusData = typeof data.msg.data === 'string' ? 
          JSON.parse(data.msg.data) : data.msg.data;
        
        this._isNavigating = statusData.is_navigating || false;
        this._currentWaypoint = statusData.current_waypoint || 0;
        this._totalWaypoints = statusData.total_waypoints || 0;
        this._status = statusData.status || this._status;
        
        this.onStateChange();
      }
    } catch (error) {
      console.error('Error parsing ROS message:', error);
    }
  }

  // Send waypoints to ROS2 navigation system
  async sendWaypoints(waypoints: Waypoint[]): Promise<void> {
    if (!this._isConnected || !this._rosSocket) {
      throw new Error("Not connected to ROS2");
    }

    this._totalWaypoints = waypoints.length;
    this._currentWaypoint = 0;
    this._status = "Sending waypoints...";
    this.onStateChange();

    try {
      // Send waypoints to the navigation system
      const waypointMessage = {
        op: 'publish',
        topic: this._rosConfig.waypointTopic,
        msg: {
          waypoints: waypoints.map((wp, index) => ({
            id: index,
            latitude: wp.lat,
            longitude: wp.lng,
            altitude: 0.0 // Default altitude
          }))
        }
      };

      this._rosSocket.send(JSON.stringify(waypointMessage));

      // Also send the first waypoint as an immediate goal
      if (waypoints.length > 0) {
        await this.sendNavigationGoal(waypoints[0]);
      }

      this._isNavigating = true;
      this._status = "Navigation started";
      this.onStateChange();

    } catch (error) {
      this._status = "Failed to send waypoints";
      this._error = error instanceof Error ? error.message : "Unknown error";
      this.onStateChange();
      throw error;
    }
  }

  // Send a single navigation goal
  private async sendNavigationGoal(waypoint: Waypoint): Promise<void> {
    if (!this._rosSocket) return;

    const goalMessage = {
      op: 'publish',
      topic: this._rosConfig.goalTopic,
      msg: {
        header: {
          stamp: {
            sec: Math.floor(Date.now() / 1000),
            nanosec: (Date.now() % 1000) * 1000000
          },
          frame_id: "map"
        },
        pose: {
          position: {
            x: waypoint.lng, // Note: You may need to convert GPS to local coordinates
            y: waypoint.lat,
            z: 0.0
          },
          orientation: {
            x: 0.0,
            y: 0.0,
            z: 0.0,
            w: 1.0
          }
        }
      }
    };

    this._rosSocket.send(JSON.stringify(goalMessage));
  }

  // Stop navigation
  async stopNavigation(): Promise<void> {
    if (!this._isConnected || !this._rosSocket) {
      throw new Error("Not connected to ROS2");
    }

    // Send stop command - this depends on your ROS2 navigation setup
    const stopMessage = {
      op: 'publish',
      topic: ROS2_CONFIG.TOPICS.STOP_NAVIGATION,
      msg: {
        data: true
      }
    };

    this._rosSocket.send(JSON.stringify(stopMessage));

    this._isNavigating = false;
    this._status = "Navigation stopped";
    this.onStateChange();
  }

  // Disconnect from ROS2
  async disconnect(): Promise<void> {
    if (this._rosSocket) {
      // Unsubscribe from topics
      const unsubscribeMsg = {
        op: 'unsubscribe',
        topic: this._rosConfig.navigationStatusTopic
      };
      
      this._rosSocket.send(JSON.stringify(unsubscribeMsg));
      this._rosSocket.close();
      this._rosSocket = null;
    }

    this._isConnected = false;
    this._isNavigating = false;
    this._status = "Disconnected";
    this.onStateChange();
  }
}
