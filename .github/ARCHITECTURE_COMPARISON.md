# Connection Architecture Comparison

## Before Refactoring ❌

Both pages were creating their own connections and subscriptions:

```typescript
// Rovers Page
createAndConnectMiniLidar() 
  ├── Creates WebSocket
  ├── Subscribes to /scan topic
  └── Handles lidar data

// Manual Control Page  
RoverController.connectToRover()
  ├── Creates WebSocket
  ├── Subscribes to /scan topic
  ├── Subscribes to /obstacle_detected topic
  ├── Subscribes to /obstacle_distance topic
  └── Handles all data + motor commands
```

**Problems:**
- 2 separate WebSocket connections to the same ROS bridge
- 2 separate subscriptions to the `/scan` lidar topic
- Duplicate code for handling lidar data
- No data sharing between pages
- Difficult to maintain consistency

---

## After Refactoring ✅

Centralized connection with shared data:

```typescript
// Single Centralized Connection
ROS2CommandCentreClient (per rover)
  ├── One WebSocket connection
  ├── One subscription to /scan
  ├── One subscription to /obstacle_detected
  ├── One subscription to /obstacle_distance
  ├── One subscription to /imu_raw
  ├── One subscription to /gps
  └── Distributes data to all subscribers

// Rovers Page
createMiniLidar() + commandCenterManager.getClient(roverId)
  ├── Gets existing client (or creates new one)
  ├── Subscribes to onLidarData() callback
  └── Updates visualization

// Manual Control Page
RoverController (motor commands only) + LidarMiniController
  ├── RoverController: WebSocket for motor commands only
  ├── commandCenterManager.getClient(roverId): Sensor data
  ├── Subscribes to onLidarData() callback
  ├── Reads obstacleData property
  └── Updates visualization
```

**Benefits:**
- ✅ Single WebSocket per rover (shared across pages)
- ✅ Single subscription to each topic
- ✅ Reusable visualization component
- ✅ Consistent data across application
- ✅ Easy to maintain and extend

---

## Code Comparison

### Before: Manual Control Lidar Subscription

```typescript
// ❌ Old way - in manualControl.ts
this._ros_socket.onopen = () => {
  // Subscribe to lidar topic
  const lidarSubscribeMsg = {
    op: 'subscribe',
    topic: this._rosConfig.lidarTopic,
    type: 'sensor_msgs/LaserScan'
  };
  
  this._ros_socket?.send(JSON.stringify(lidarSubscribeMsg));
  // ... more subscriptions
};

this._ros_socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.topic === this._rosConfig.lidarTopic && data.msg) {
    if (this._lidarHandler) {
      this._lidarHandler(data.msg);
    }
  }
  // ... handle other topics
};
```

### After: Centralized Connection

```typescript
// ✅ New way - in +page.svelte
// Create visualization controller
lidarController = createMiniLidar({ canvas: 'lidarCanvas' });

// Get centralized client
commandCenterClient = commandCenterManager.getClient(roverId);

// Connect once
await commandCenterClient.connect();

// Subscribe to updates
commandCenterClient.onLidarData((lidarData) => {
  lidarController.updateData(lidarData);
});

// Obstacle data is just a property
const obstacleData = commandCenterClient.obstacleData;
```

---

## File Size Reduction

### manualControl.ts
- **Before**: ~639 lines
- **After**: ~350 lines
- **Reduction**: ~289 lines (45% smaller)

**Removed code:**
- Lidar visualization (130+ lines)
- Lidar subscription logic (40+ lines)
- Obstacle detection handling (50+ lines)
- Message parsing for sensor topics (40+ lines)
- Unsubscribe logic (30+ lines)

---

## Connection Management

### Before:
```
Page 1: Rover Details
  └── WebSocket 1 → ROS Bridge
        └── Subscribes to /scan

Page 2: Manual Control
  └── WebSocket 2 → ROS Bridge
        └── Subscribes to /scan
        └── Subscribes to /obstacle_detected
        └── Subscribes to /obstacle_distance

Result: 2 WebSockets, duplicate /scan subscription
```

### After:
```
commandCenterManager
  └── rover-1 → ROS2CommandCentreClient
        └── WebSocket 1 → ROS Bridge
              └── Subscribes to /scan (once)
              └── Subscribes to /obstacle_detected (once)
              └── Subscribes to /obstacle_distance (once)
              └── Distributes data to:
                    ├── Page 1: Rover Details
                    └── Page 2: Manual Control

Result: 1 WebSocket, single subscription per topic
```

---

## Key Takeaways

1. **Centralization is Key**: One connection manager for all rover communication
2. **Separation of Concerns**: Visualization, data fetching, and commands are separate
3. **Reusability**: `LidarMiniController` can be used anywhere
4. **Performance**: Fewer connections and subscriptions = better performance
5. **Maintainability**: Changes to data handling happen in one place

---

## What This Means for Development

### Adding a New Sensor:
**Before**: Add to each page that needs it
**After**: Add once to `ROS2CommandCentreClient`

### Debugging Sensor Issues:
**Before**: Check multiple files and connections
**After**: Check one place - `ROS2CommandCentreClient`

### Sharing Data Between Pages:
**Before**: Impossible (separate connections)
**After**: Automatic (shared client instance)

### Connection Management:
**Before**: Each page manages its own lifecycle
**After**: Centralized manager handles everything
