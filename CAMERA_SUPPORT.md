# Multi-Camera WebRTC Support

## Overview

The ROS2 Command Centre now supports two camera streams simultaneously:

- **CSI Camera** - Running on port 8765 (default)
- **USB Camera** - Running on port 8766 (new)

## Changes Made

### Configuration (`ros2Config.ts`)

- Added separate port configuration for each camera:
  - `WEBRTC_PORT_CSI: 8765` - CSI camera WebRTC port
  - `WEBRTC_PORT_USB: 8766` - USB camera WebRTC port
- Updated `getWebRTCWebSocketURL()` to accept camera type parameter

### Command Centre Client (`ros2CommandCentre.ts`)

#### New Interfaces

```typescript
export interface WebRTCStatus {
	isConnected: boolean;
	hasRemoteStream: boolean;
	videoElementId: string | null;
	cameraType: 'csi' | 'usb';
}

export interface CameraStreamStatus {
	csi: WebRTCStatus;
	usb: WebRTCStatus;
}
```

#### Updated Methods

**Connection Management:**

```typescript
// Connect with specific cameras enabled/disabled
await client.connect({
	enableCSICamera: true, // default: true
	enableUSBCamera: true // default: true
});
```

**Video Element Binding:**

```typescript
// Bind video element to CSI camera (backward compatible)
client.setVideoElement('csi-video-element');

// Bind video element to USB camera
client.setVideoElement('usb-video-element', 'usb');

// Clear video element for CSI camera
client.setVideoElement(null, 'csi');
```

**Status Monitoring:**

```typescript
// Subscribe to WebRTC status changes for both cameras
const cleanup = client.onWebRTCStatusChange((status: CameraStreamStatus) => {
	console.log('CSI Camera:', {
		connected: status.csi.isConnected,
		hasStream: status.csi.hasRemoteStream,
		videoElement: status.csi.videoElementId
	});

	console.log('USB Camera:', {
		connected: status.usb.isConnected,
		hasStream: status.usb.hasRemoteStream,
		videoElement: status.usb.videoElementId
	});
});

// Cleanup when done
cleanup();
```

**Connection Status Getters:**

```typescript
client.isWebRTCConnected; // true if ANY camera is connected
client.isCSICameraConnected; // true if CSI camera is connected
client.isUSBCameraConnected; // true if USB camera is connected
```

## Usage Example

```typescript
import { commandCenterManager } from '$lib/ros2CommandCentre';

// Get client for a rover
const client = commandCenterManager.getClient('rover-123');

// Connect with both cameras enabled
await client.connect({
	enableCSICamera: true,
	enableUSBCamera: true
});

// Subscribe to camera status
client.onWebRTCStatusChange((status) => {
	// Update UI based on camera status
	if (status.csi.hasRemoteStream) {
		console.log('CSI camera stream ready');
	}
	if (status.usb.hasRemoteStream) {
		console.log('USB camera stream ready');
	}
});

// Bind video elements (in your Svelte component after mount)
onMount(() => {
	client.setVideoElement('csi-video', 'csi');
	client.setVideoElement('usb-video', 'usb');
});

// Disconnect specific camera if needed
client.disconnectWebRTC('usb');

// Disconnect all
client.disconnect();
```

## HTML Structure Example

```html
<div class="camera-grid">
	<div class="camera-feed">
		<h3>CSI Camera</h3>
		<video id="csi-video" autoplay muted playsinline></video>
	</div>

	<div class="camera-feed">
		<h3>USB Camera</h3>
		<video id="usb-video" autoplay muted playsinline></video>
	</div>
</div>
```

## Backward Compatibility

The API remains backward compatible:

- `setVideoElement(elementId)` defaults to CSI camera
- `connect()` enables both cameras by default
- Existing code will continue to work with the CSI camera

## Migration Guide

### Before (Single Camera)

```typescript
// Old way - only CSI camera
await client.connect({ enableVideo: true });
client.setVideoElement('video-element');
```

### After (Multi-Camera)

```typescript
// New way - both cameras
await client.connect({
	enableCSICamera: true,
	enableUSBCamera: true
});
client.setVideoElement('csi-video', 'csi');
client.setVideoElement('usb-video', 'usb');

// Or use backward compatible default (CSI camera)
client.setVideoElement('video-element'); // Defaults to 'csi'
```

## Technical Details

### WebRTC Connection Management

- Each camera maintains its own:
  - WebSocket connection
  - RTCPeerConnection
  - Remote MediaStream
  - Video element binding
  - Connection status

### Independent Control

- Cameras can be connected/disconnected independently
- Each camera can be bound to different video elements
- Status updates include both cameras' information

### Error Handling

- Connection errors are logged per camera type
- Failed connections don't affect the other camera
- Automatic retry logic per camera

## Notes

1. Both cameras must be running their respective WebRTC servers on the rover
2. Video elements must exist in the DOM before calling `setVideoElement()`
3. Remember to call cleanup functions for status listeners to prevent memory leaks
4. Cameras are muted by default to comply with browser autoplay policies
