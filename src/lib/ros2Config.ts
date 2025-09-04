// ROS2 Configuration for Rover Navigation
export const ROS2_CONFIG = {
  // Raspberry Pi connection settings
  RASPBERRY_PI_IP: "100.85.202.20", // Tailscale IP address of the Raspberry Pi
  ROS_BRIDGE_PORT: 9090,
  WEBRTC_PORT: 8765,

  // ROS2 Topics
  TOPICS: {
    // Command Center Communication
    ROVER_COMMAND: "/rover/command",        // Commands to rover (LaunchRover, ManualControl, Stop)
    ROVER_SWDATA: "/rover/swdata",          // Software data (waypoints, navigation params)
    ROVER_HEARTBEAT: "/rover/heartbeat",    // Heartbeat from software to rover
    ROVER_STATE: "/rover/state",            // Rover state updates (idle, manual_control, autonomous)
    
    // Navigation topics
    WAYPOINTS: "/rover/waypoints",          // Internal rover waypoints topic
    NAVIGATION_STATUS: "/navigation_status", 
    GOAL: "/move_base_simple/goal",
    PATH: "/navigation_path",
    STOP_NAVIGATION: "/navigation_stop",
    
    // Existing topics from manual control
    COMMAND: "/JSON",                       // Legacy command topic for manual control
    LIDAR: "/scan",
    OBSTACLE_DETECTED: "/obstacle_detected",
    OBSTACLE_DISTANCE: "/obstacle_distance", 
    GPS: "/fix"
  },

  // Connection timeout settings
  CONNECTION_TIMEOUT: 5000, // 5 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000 // 2 seconds
};

// Helper function to validate IP address
export function isValidIP(ip: string): boolean {
  const parts = ip.split('.');
  return parts.length === 4 && parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255 && !isNaN(num);
  });
}

// Helper function to get WebSocket URL
export function getROSWebSocketURL(ip?: string, port?: number): string {
  const rosIP = ip || ROS2_CONFIG.RASPBERRY_PI_IP;
  const rosPort = port || ROS2_CONFIG.ROS_BRIDGE_PORT;
  return `ws://${rosIP}:${rosPort}`;
}

// Helper function to get WebRTC WebSocket URL
export function getWebRTCWebSocketURL(ip?: string, port?: number): string {
  const rosIP = ip || ROS2_CONFIG.RASPBERRY_PI_IP;
  const webrtcPort = port || ROS2_CONFIG.WEBRTC_PORT;
  return `ws://${rosIP}:${webrtcPort}`;
}
