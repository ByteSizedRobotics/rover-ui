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
}

export class RoverController {
  private _isConnected: boolean = false;
  private _currentMove: string = "Idle";
  private _connectionStatus: string = "Disconnected";
  private _statusColor: string = "text-red-500";
  private _logs: LogEntry[] = [];
  private _webrtc_socket: WebSocket | null = null;
  private _ros_socket: WebSocket | null = null;
  private _rosConfig: RosConfig;
  private _speed: number = 1; // Default speed setting
  
  // Callback function for state updates
  private onStateChange: () => void;
  private _lidarHandler: ((data: any) => void) | null = null; // TODO: NATHAN handle lidar data, just display it with viz, and display obstacle detection message from channel
  
  constructor(onStateChange: () => void, rosConfig: RosConfig = { 
    url: "", //TODO: NATHAN add url
    rosPort: 9090,
    webrtcPort: 8765,
    commandTopic: "/JSON",
    lidarTopic: "/scan"
  }) {
    this.onStateChange = onStateChange;
    this._rosConfig = rosConfig;
  }
  
  // Getters
  get isConnected(): boolean { return this._isConnected; }
  get currentMove(): string { return this._currentMove; }
  get connectionStatus(): string { return this._connectionStatus; }
  get statusColor(): string { return this._statusColor; }
  get logs(): LogEntry[] { return this._logs; }
  
  // Set lidar handler for external processing
  setLidarHandler(handler: (data: any) => void): void {
    this._lidarHandler = handler;
  }
  
  connectToRover(): Promise<void> {
    this._connectionStatus = "Connecting...";
    this._statusColor = "text-yellow-500";
    this.onStateChange();
    
    return new Promise((resolve, reject) => {
      try {        
        // ROS WebSocket Connection
        const wsUrlROS = `ws://${this._rosConfig.url}:${this._rosConfig.rosPort}`;
        this._ros_socket = new WebSocket(wsUrlROS);
        
        // WebRTC WebSocket Connection
        this._webrtc_socket = new WebSocket(`ws://${this._rosConfig.url}:${this._rosConfig.webrtcPort || 8765}`);
        
        // WebRTC Socket Event Handlers
        this._webrtc_socket.onopen = () => {
          if (this._webrtc_socket) {
            this.addLog(`WebRTC connection established at ${this._webrtc_socket.url}`);
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
            switch(data.type) {
              case 'offer':
                this.handleWebRTCOffer(data); // Handle incoming offer (video stream)
                break;
              default:
                this.addLog(`Received unknown WebRTC message type: ${data.type}`);
            }
          } catch (e) {
            this.addLog(`Error parsing WebRTC message: ${e}`);
          }
        };
        
        // ROS Socket Event Handlers (existing code remains the same)
        this._ros_socket.onopen = () => {
          const lidarSubscribeMsg = {
            op: 'subscribe',
            topic: this._rosConfig.lidarTopic,
            type: 'sensor_msgs/LaserScan'
          };
          
          this._ros_socket?.send(JSON.stringify(lidarSubscribeMsg));
          
          this._isConnected = true;
          this._connectionStatus = "Connected";
          this._statusColor = "text-green-500";
          this.addLog(`Connected to ROS at ${wsUrlROS}`);
          this.onStateChange();
          resolve();
        };
        
        this._ros_socket.onerror = (error) => {
          this._isConnected = false;
          this._connectionStatus = "Connection failed";
          this._statusColor = "text-red-500";
          this.addLog(`Connection error: ${error.type}`);
          this.onStateChange();
          reject(error);
        };
        
        this._ros_socket.onclose = () => {
          this._isConnected = false;
          this._connectionStatus = "Disconnected";
          this._statusColor = "text-red-500";
          this.addLog("ROS connection closed");
          this.onStateChange();
        };
        
        this._ros_socket.onmessage = (event) => { //TODO: NATHAN handle lidar data, just display it with viz, and display obstacle detection message from channel
          try {
            const data = JSON.parse(event.data);
            
            // Handle lidar data with external handler if available
            if (data.topic === this._rosConfig.lidarTopic && data.msg && this._lidarHandler) {
              this._lidarHandler(data.msg);
              this.addLog(`Received lidar scan with ${data.msg.ranges?.length || 0} points`);
            } else if (data.topic === this._rosConfig.commandTopic) {
              // Handle command responses if needed
              this.addLog(`Received command response`);
            }
            
            this.onStateChange();
          } catch (e) {
            this.addLog(`Error parsing message: ${e}`);
            this.onStateChange();
          }
        };
        
      } catch (error) {
        this._isConnected = false;
        this._connectionStatus = "Connection failed";
        this._statusColor = "text-red-500";
        this.addLog(`Failed to connect: ${error}`);
        this.onStateChange();
        reject(error);
      }
    });
  }
  
  private peerConnection: RTCPeerConnection | null = null;

  private handleWebRTCOffer(offer: any) {
    this.addLog('Received WebRTC offer');
  
    // Initialize the WebRTC peer connection
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
  
    // Set the received offer as the remote description
    this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  
    // Handle incoming video stream
    this.peerConnection.ontrack = (event) => {
      const videoElement = document.getElementById("roverVideo") as HTMLVideoElement;
      if (videoElement) {
        videoElement.srcObject = event.streams[0];
        this.addLog("WebRTC video stream received");
      }
    };
  }
  
  disconnectFromRover(): Promise<void> {
    this._connectionStatus = "Disconnecting...";
    this._statusColor = "text-yellow-500";
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
        
        this._ros_socket.send(JSON.stringify(commandUnsubscribeMsg));
        this._ros_socket.send(JSON.stringify(lidarUnsubscribeMsg));
        this._ros_socket.close();
      }
      
      this._isConnected = false;
      this._connectionStatus = "Disconnected";
      this._statusColor = "text-red-500";
      this._ros_socket = null;
      this.addLog("Disconnected from ROS");
      this.onStateChange();
      resolve();
    });
  }
  
  // Send command to ROS
  private publishCommand(command: string): void {
    if (!this._isConnected || !this._ros_socket) {
      this.addLog("Cannot send command: Not connected to ROS");
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
      this._currentMove = "Forward";
      const command = `{"T":1,"L":${0.1 * this._speed},"R":${0.1 * this._speed}}`;
      this.publishCommand(command);
    }
  }
  
  moveBackward(): void {
    if (this._isConnected) {
      this._currentMove = "Backward";
      const command = `{"T":1,"L":${-0.1 * this._speed},"R":${-0.1 * this._speed}}`;
      this.publishCommand(command);
    }
  }
  
  moveLeft(): void {
    if (this._isConnected) {
      this._currentMove = "Left";
      const command = `{"T":1,"L":${-0.25 * this._speed},"R":${0.25 * this._speed}}`;
      this.publishCommand(command);
    }
  }
  
  moveRight(): void {
    if (this._isConnected) {
      this._currentMove = "Right";
      const command = `{"T":1,"L":${0.25 * this._speed},"R":${-0.25 * this._speed}}`;
      this.publishCommand(command);
    }
  }
  
  stopMovement(): void {
    if (this._isConnected) {
      this._currentMove = "Idle";
      const command = '{"T":1,"L":0,"R":0}';
      this.publishCommand(command);
    }
  }
  
  // Logging
  addLog(message: string): void {
    const now = new Date();
    const timestamp = now.toLocaleTimeString();
    this._logs = [{time: timestamp, message}, ...this._logs].slice(0, 10); // Keep only last 10 logs
  }
  
  // Keyboard handling
  handleKeyDown(event: KeyboardEvent): void {
    if (!this._isConnected) return;
    
    switch(event.key) {
      case "w":
      case "ArrowUp":
        this.moveForward();
        break;
      case "s":
      case "ArrowDown":
        this.moveBackward();
        break;
      case "a":
      case "ArrowLeft":
        this.moveLeft();
        break;
      case "d":
      case "ArrowRight":
        this.moveRight();
        break;
      case " ": // Spacebar
      case "q":
        this.stopMovement();
        break;
    }
  }
  
  handleKeyUp(event: KeyboardEvent): void {
    if (!this._isConnected) return;
    
    // Stop movement when key is released
    if (["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      this.stopMovement();
    }
  }
}