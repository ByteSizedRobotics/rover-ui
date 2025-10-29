# WebRTC Video Feed Centralization

## Overview

The WebRTC video streaming functionality has been centralized into `ROS2CommandCentreClient`, eliminating duplicate connections and code across the rovers and manual control pages.

## Changes Made

### 1. `ROS2CommandCentreClient` - Centralized WebRTC Manager

The Command Center already had WebRTC support built-in:

#### Features:

- ✅ Single WebRTC peer connection per rover
- ✅ Automatic connection on Command Center connect
- ✅ `setVideoElement(id)` method to bind video to any element
- ✅ Automatic stream application when track arrives
- ✅ Proper cleanup on disconnect

#### API:

```typescript
// Get command center client
const client = commandCenterManager.getClient(roverId);

// Connect (automatically initializes WebRTC)
await client.connect();

// Bind video element
client.setVideoElement('myVideoElementId');

// Change video element (e.g., camera switching)
client.setVideoElement('anotherVideoElementId');

// Disconnect (automatically cleans up WebRTC)
client.disconnect();
```

### 2. Rovers Page (`/rovers/[id]`)

#### Removed:

- ❌ `webrtcSocket` state variable
- ❌ `peerConnection` state variable
- ❌ `remoteStream` state variable
- ❌ `webrtcConnected` state variable
- ❌ `startWebRTC()` function
- ❌ `connectWebRTC()` function
- ❌ `bindStreamToCurrentCamera()` function
- ❌ Import of `getWebRTCWebSocketURL`
- ❌ Duplicate WebRTC cleanup in `onDestroy`

#### Updated:

```typescript
// OLD: Manual WebRTC connection
connectWebRTC();
bindStreamToCurrentCamera();

// NEW: Use centralized WebRTC
commandCenterClient = commandCenterManager.getClient(roverId);
await commandCenterClient.connect();
commandCenterClient.setVideoElement(`roverVideo${currentCamera}`);

// Camera switching
function switchCamera(cameraNum: number) {
	currentCamera = cameraNum;
	commandCenterClient.setVideoElement(`roverVideo${cameraNum}`);
}
```

### 3. Manual Control Page (`/manual-ctrl/[id]`)

#### Removed from `manualControl.ts`:

- ❌ `_webrtc_socket` property
- ❌ `peerConnection` property
- ❌ `webrtcPort` from config
- ❌ `startWebRTC()` method
- ❌ All WebRTC socket handlers
- ❌ Import of `getWebRTCWebSocketURL`
- ❌ ~70 lines of duplicate WebRTC code

#### Updated in `+page.svelte`:

```typescript
// OLD: RoverController handled video
await controller.connectToRover(); // WebRTC happened here

// NEW: Command Center handles video
controller = new RoverController(() => {}); // Motor commands only
commandCenterClient = commandCenterManager.getClient(roverId);
await commandCenterClient.connect();
commandCenterClient.setVideoElement('roverVideo');
```

## Architecture Improvement

### Before:

```
Rovers Page
├── Own WebSocket → WebRTC Server
├── Own RTCPeerConnection
└── Binds to video elements

Manual Control Page
├── RoverController
│   ├── Own WebSocket → WebRTC Server
│   ├── Own RTCPeerConnection
│   └── Binds to video element
└── Motor commands

Result: 2 WebRTC connections per rover ❌
```

### After:

```
ROS2CommandCentreClient (per rover)
├── Single WebSocket → WebRTC Server
├── Single RTCPeerConnection
└── Provides setVideoElement() API

Rovers Page
└── commandCenterClient.setVideoElement('roverVideo1')

Manual Control Page
├── RoverController (motor commands only)
└── commandCenterClient.setVideoElement('roverVideo')

Result: 1 WebRTC connection per rover ✅
```

## Benefits

### 1. **Single Connection**

- Only one WebRTC peer connection per rover
- No duplicate signaling WebSockets
- Reduced network overhead

### 2. **Code Simplification**

- **Rovers page**: -90 lines of WebRTC code
- **Manual control**: -70 lines of WebRTC code
- **RoverController**: -100+ lines, now focused only on motor commands
- Total: ~260 lines of duplicate code removed

### 3. **Better Separation of Concerns**

- `ROS2CommandCentreClient`: Handles ALL rover communication (sensors + video + commands)
- `RoverController`: Handles ONLY motor commands
- Pages: Just bind video elements, no connection management

### 4. **Easier Video Element Management**

- Simple `setVideoElement(id)` API
- No need to manage streams, tracks, or peer connections
- Automatic stream application when ready
- Easy to switch video elements (e.g., camera switching)

### 5. **Consistent Lifecycle**

- Video connects/disconnects with Command Center
- No orphaned connections
- Automatic cleanup

## Usage Examples

### Basic Video Display

```typescript
// Get client and connect
const client = commandCenterManager.getClient('rover-1');
await client.connect();

// Bind video element
client.setVideoElement('myVideo');

// In HTML
<video id="myVideo" autoplay playsinline></video>
```

### Multiple Camera Views (Rovers Page)

```typescript
let currentCamera = 1;

// Initial setup
commandCenterClient.setVideoElement(`roverVideo${currentCamera}`);

// Switch cameras
function switchCamera(num: number) {
  currentCamera = num;
  commandCenterClient.setVideoElement(`roverVideo${num}`);
}

// In HTML
<video id="roverVideo1" autoplay playsinline></video>
<video id="roverVideo2" autoplay playsinline></video>
```

### Manual Control (Single Camera)

```typescript
// Connect command center
commandCenterClient = commandCenterManager.getClient(roverId);
await commandCenterClient.connect();
commandCenterClient.setVideoElement('roverVideo');

// Create motor controller separately
controller = new RoverController(() => {});
await controller.connectToRover(); // Only for motor commands

// In HTML
<video id="roverVideo" autoplay playsinline></video>
```

## Data Flow

### Video Stream Flow:

```
Rover Camera
  ↓
WebRTC Server (on rover)
  ↓
ROS2CommandCentreClient
  ├── WebSocket (signaling)
  ├── RTCPeerConnection
  └── MediaStream
      ↓
  setVideoElement('elementId')
      ↓
  <video> element in UI
```

### Complete System:

```
ROS2 Topics (sensors)  →  ROS2CommandCentreClient  ←  WebRTC Server (video)
                              ↓           ↓
                          Sensors      Video
                              ↓           ↓
                          onLidarData   setVideoElement
                              ↓           ↓
                        LidarController  <video>
```

## Migration Guide

If you have other pages using direct WebRTC:

### Step 1: Remove Direct WebRTC Code

```typescript
// Remove these
let webrtcSocket: WebSocket | null = null;
let peerConnection: RTCPeerConnection | null = null;
let remoteStream: MediaStream | null = null;

function connectWebRTC() {
	/* ... */
}
function startWebRTC() {
	/* ... */
}
```

### Step 2: Use Command Center

```typescript
// Add this
let commandCenterClient: ROS2CommandCentreClient | null = null;

// In onMount
commandCenterClient = commandCenterManager.getClient(roverId);
await commandCenterClient.connect();
commandCenterClient.setVideoElement('yourVideoElementId');

// In onDestroy
commandCenterClient.disconnect();
```

### Step 3: Update Video Elements

```typescript
// Make sure video elements have IDs
<video id="yourVideoElementId" autoplay playsinline></video>
```

## Testing Checklist

### Video Display

- [ ] Video appears on rovers page (camera 1)
- [ ] Video appears on manual control page
- [ ] Video is smooth (no stuttering)
- [ ] Video survives page navigation
- [ ] Video reconnects after disconnect

### Camera Switching (Rovers Page)

- [ ] Camera 1 button displays camera 1 feed
- [ ] Camera 2 button displays camera 2 feed
- [ ] Switching is instant (uses same stream)
- [ ] Active button is highlighted correctly

### Connection Management

- [ ] Only ONE WebRTC connection per rover (check DevTools Network → WS)
- [ ] Connection closes when leaving page
- [ ] Connection reestablishes when returning
- [ ] No orphaned connections

### Integration with Sensors

- [ ] Lidar still works
- [ ] Obstacle detection still works
- [ ] IMU data still works
- [ ] Video doesn't interfere with sensor data

### Performance

- [ ] No duplicate WebRTC connections
- [ ] No memory leaks
- [ ] CPU usage is reasonable
- [ ] Video latency is acceptable

## Troubleshooting

### Video Not Showing

1. Check Command Center connection: `commandCenterClient.isConnected`
2. Check if video element exists: `document.getElementById('yourId')`
3. Verify video element ID matches `setVideoElement()` call
4. Check WebRTC connection in Command Center (look for logs)
5. Verify WebRTC server is running on rover

### Video Freezes

1. Check network connection
2. Look for WebRTC errors in console
3. Verify peer connection state
4. Check rover's WebRTC server status

### Multiple Videos Not Working

1. Make sure each video has unique ID
2. Call `setVideoElement()` for each switch
3. Verify stream is being shared (not duplicated)

### Motor Commands Stopped Working

1. Make sure `RoverController.connectToRover()` is still called
2. Verify ROS WebSocket is separate from WebRTC
3. Check that motor command topic is correct

## Related Files

- `/src/lib/ros2CommandCentre.ts` - Centralized connection manager with WebRTC
- `/src/routes/rovers/[id]/+page.svelte` - Rovers page using centralized WebRTC
- `/src/routes/manual-ctrl/[id]/+page.svelte` - Manual control page
- `/src/routes/manual-ctrl/[id]/manualControl.ts` - Motor controller (WebRTC removed)
- `/LIDAR_INTEGRATION.md` - Lidar centralization documentation
- `/.github/MANUAL_CONTROL_REFACTOR.md` - Manual control refactoring docs

## Future Improvements

1. **Multi-Rover Support**: Test with multiple rovers simultaneously
2. **Connection Recovery**: Auto-reconnect on video failure
3. **Quality Settings**: Allow adjusting video quality
4. **Recording**: Add ability to record video streams
5. **Snapshots**: Take still images from video feed
6. **Stats**: Display WebRTC statistics (bandwidth, latency, etc.)
