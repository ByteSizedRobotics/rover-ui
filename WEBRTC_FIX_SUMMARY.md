# WebRTC Camera Stream Fix Summary

## Issues Found and Fixed

### 1. **Indentation/Syntax Errors** (CRITICAL - FIXED ✅)
- **File**: `src/routes/manual-ctrl/[id]/+page.svelte`
- **Problem**: Escaped tab characters (`\t`) instead of actual tabs, causing JavaScript syntax errors
- **Fix**: Replaced escaped characters with proper indentation
- **Impact**: Page wouldn't load/execute properly, breaking everything

### 2. **Svelte 5 Runes Mode Compatibility** (FIXED ✅)
- **File**: `src/routes/manual-ctrl/[id]/+page.svelte`
- **Problems**:
  - Used legacy `$:` reactive statements instead of `$state`/`$derived`
  - Missing type imports (`LogEntry`)
  - Trying to assign to derived state
- **Fixes**:
  - Converted to `$state` variables
  - Imported `LogEntry` type
  - Added proper null checks
- **Impact**: TypeScript errors, reactivity not working

### 3. **WebRTC Timing Issues** (FIXED ✅)
- **File**: `src/lib/ros2CommandCentre.ts`
- **Problem**: `setVideoElement()` was called before WebRTC connection was fully established
- **Fixes**:
  - Added `waitForWebRTCAndApply()` retry logic (max 50 retries @ 100ms = 5 seconds)
  - Improved `applyStreamToVideo()` with retry for video element not in DOM yet
  - Added comprehensive console logging for debugging
  - Better error handling with fallback to muted playback
- **Impact**: Video stream wouldn't bind to video elements

### 4. **Missing Video Attributes** (FIXED ✅)
- **File**: `src/routes/manual-ctrl/[id]/+page.svelte`
- **Problem**: Video element missing `muted` attribute
- **Fix**: Added `muted` attribute to video element
- **Impact**: Autoplay might be blocked by browser without mute

### 5. **Missing Visual Feedback** (FIXED ✅)
- **File**: `src/routes/manual-ctrl/[id]/+page.svelte`
- **Problem**: No visual indication when camera isn't connected
- **Fix**: Added fallback UI showing connection status
- **Impact**: Users couldn't tell if camera was connecting or failed

## Changes Made

### `src/lib/ros2CommandCentre.ts`

#### Improved `setVideoElement()` method:
```typescript
public setVideoElement(videoElementId: string): void {
    this._currentVideoElementId = videoElementId;
    console.log(`Setting video element '${videoElementId}' for rover ${this._roverId}`);

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
```

#### New `waitForWebRTCAndApply()` method:
- Retries up to 50 times (5 seconds total)
- Waits for both `_remoteStream` and `_currentVideoElementId` to be ready
- Logs progress for debugging

#### Improved `applyStreamToVideo()` method:
- Better error logging
- Retry logic if video element not found (500ms delay)
- Automatic retry with muted=true if autoplay fails
- Comprehensive status logging

### `src/routes/manual-ctrl/[id]/+page.svelte`

1. **Fixed indentation issues**
2. **Converted to Svelte 5 runes mode**:
   - Changed `$:` to `$state`
   - Fixed type imports
   - Added proper null checks
3. **Added `muted` attribute to video element**
4. **Added visual feedback** when camera isn't connected

## How It Works Now

### Connection Flow:
```
1. User opens page
   ↓
2. onMount() fires
   ↓
3. Get commandCenterClient from manager
   ↓
4. commandCenterClient.connect()
   ├→ Opens ROS WebSocket
   ├→ Subscribes to topics
   ├→ Calls connectWebRTC() (async)
   └→ Resolves promise
   ↓
5. In .then() callback:
   └→ Call setVideoElement('roverVideo')
       ├→ Checks if stream exists
       ├→ If not, calls waitForWebRTCAndApply()
       └→ Retries every 100ms for up to 5 seconds
   ↓
6. WebRTC connection completes:
   ├→ WebSocket opens
   ├→ Peer connection created
   ├→ Offer sent
   ├→ Answer received
   └→ ontrack event fires
       ├→ _remoteStream set
       └→ applyStreamToVideo() called
   ↓
7. Video plays!
```

## Testing Checklist

### Manual Control Page
- [ ] Open `/manual-ctrl/{roverId}` page
- [ ] Check browser console for logs:
  - [ ] `[Manual Control] Connecting to command center for rover: {id}`
  - [ ] `[Manual Control] ✅ Connected to ROS2 Command Center`
  - [ ] `Setting video element 'roverVideo' for rover {id}`
  - [ ] `✅ WebRTC video stream successfully playing on 'roverVideo'`
- [ ] Video element should show camera feed
- [ ] If no camera: Shows blue overlay with "Connecting to camera..."
- [ ] Motor controls should work independently

### Rovers Page
- [ ] Open `/rovers/{roverId}` page
- [ ] Video should appear for camera 1 by default
- [ ] Click "Camera 2" button - should switch to camera 2 feed
- [ ] Click "Camera 1" button - should switch back
- [ ] Lidar visualization should work
- [ ] Sensor data should update

## Console Logging

The system now logs extensively to help debug:

### Good Signs (What You Should See):
```
Setting video element 'roverVideo' for rover test-rover
WebRTC connection established for rover test-rover
Starting WebRTC connection for rover test-rover...
WebRTC offer sent to ROS 2 server for rover test-rover
WebRTC answer received and applied for rover test-rover
WebRTC video stream received for rover test-rover
Applying WebRTC stream to video element 'roverVideo' for rover test-rover
Stream source set for video element
✅ WebRTC video stream successfully playing on 'roverVideo' for rover test-rover
```

### Bad Signs (What Indicates Problems):
```
❌ WebRTC connection error for rover test-rover
❌ Error playing video for rover test-rover
Video element with id 'roverVideo' not found
WebRTC failed to initialize after 50 retries
Cannot apply stream: elementId=null, hasStream=false
```

## Troubleshooting

### Video Not Showing

1. **Check Console Logs** - Look for error messages
2. **Check WebRTC Server** - Is it running on the rover at port 8765?
3. **Check Network** - Can browser reach `ws://{ROVER_IP}:8765`?
4. **Check Video Element** - Does `document.getElementById('roverVideo')` exist?
5. **Check Browser Permissions** - Some browsers block autoplay

### Connection Issues

1. **Check ROS Bridge** - Is it running on port 9090?
2. **Check rover IP** - Is `RASPBERRY_PI_IP` correct in `ros2Config.ts`?
3. **Check Tailscale** - Is Tailscale connected?

### Still Not Working?

1. Open browser DevTools (F12)
2. Go to Network tab → WS filter
3. Look for WebSocket connections:
   - `ws://{IP}:9090` - ROS Bridge (should be connected)
   - `ws://{IP}:8765` - WebRTC signaling (should be connected)
4. Check if WebSockets are closing/erroring
5. Check Console tab for JavaScript errors

## Next Steps

1. **Test** the manual control page
2. **Test** the rovers page  
3. **Check console logs** during connection
4. **Report** what you see in the console
5. If still not working, we'll add more debugging

## Configuration

Current WebRTC settings in `ros2Config.ts`:
```typescript
RASPBERRY_PI_IP: '100.85.202.20'  // Tailscale IP
ROS_BRIDGE_PORT: 9090
WEBRTC_PORT: 8765
```

Make sure these match your rover's configuration!
