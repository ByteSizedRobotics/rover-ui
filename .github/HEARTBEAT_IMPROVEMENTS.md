# Heartbeat Improvements Documentation

## Issue Description

The heartbeat function in `ROS2CommandCentreClient` was silently failing to send heartbeat messages to the rover. The function appeared to run once but then stopped working without any error messages or logs, making it difficult to debug.

## Root Cause Analysis

### Original Implementation Issues

1. **Silent Failures**: The `sendHeartbeat()` function had an early return with no logging:
   ```typescript
   if (!this._isConnected || !this._socket) return;
   ```
   This made it impossible to know why heartbeats weren't being sent.

2. **No Error Handling**: No try-catch block meant any errors during sending would crash the interval silently.

3. **No WebSocket State Check**: Didn't verify if the WebSocket was in the OPEN state before sending.

4. **No Debugging Information**: No console logs to track heartbeat activity.

5. **Missing Navigation State**: Heartbeat didn't include the rover's navigation state.

## Improvements Implemented

### 1. Enhanced Logging System

Added comprehensive logging with prefixed messages `[Heartbeat]` for easy filtering:

```typescript
// When starting
console.log(`[Heartbeat] Starting heartbeat for rover ${this._roverId}`);

// On successful send
console.log(`[Heartbeat] ✓ Sent heartbeat for rover ${this._roverId} (navigating=${this._isNavigating})`);

// When connection issues occur
console.warn(`[Heartbeat] Cannot send heartbeat for rover ${this._roverId}: Not connected`);

// On errors
console.error(`[Heartbeat] ✗ Failed to send heartbeat for rover ${this._roverId} (error #${this._heartbeatErrors}):`, error);
```

### 2. Error Tracking and Recovery

Added `_heartbeatErrors` counter to track consecutive failures:

```typescript
private _heartbeatErrors: number = 0;
```

**Behavior:**
- Resets to 0 on successful heartbeat
- Increments on each failure
- After 5 consecutive errors, stops the heartbeat to prevent spam
- Helps identify persistent connection issues

### 3. WebSocket State Validation

Added explicit check for WebSocket readiness:

```typescript
if (this._socket.readyState !== WebSocket.OPEN) {
    console.warn(`[Heartbeat] Cannot send heartbeat: WebSocket not ready (state=${this._socket.readyState})`);
    return;
}
```

**WebSocket States:**
- `0` = CONNECTING
- `1` = OPEN (ready to send)
- `2` = CLOSING
- `3` = CLOSED

### 4. Enhanced Heartbeat Message

Added navigation state to heartbeat data:

```typescript
{
    rover_id: this._roverId,
    timestamp: Date.now(),
    status: 'alive',
    is_navigating: this._isNavigating  // ← NEW
}
```

This allows the rover to know if the UI expects it to be navigating.

### 5. Try-Catch Error Handling

Wrapped the entire send operation in try-catch:

```typescript
try {
    // Create and send message
    this._socket.send(JSON.stringify(heartbeatMsg));
    this._lastHeartbeat = Date.now();
    this._heartbeatErrors = 0;
    console.log(`[Heartbeat] ✓ Sent heartbeat...`);
} catch (error) {
    this._heartbeatErrors++;
    console.error(`[Heartbeat] ✗ Failed to send heartbeat:`, error);
    
    if (this._heartbeatErrors >= 5) {
        console.error(`[Heartbeat] Too many errors, stopping heartbeat`);
        this.stopHeartbeat();
    }
}
```

## How It Works Now

### Heartbeat Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Connection Lifecycle                      │
└─────────────────────────────────────────────────────────────┘

User connects to rover
         │
         ▼
   connect() called
         │
         ├─ Open WebSocket
         ├─ Subscribe to topics
         └─ startHeartbeat() ◄────────────┐
                │                          │
                ▼                          │
         Clear existing interval          │
                │                          │
                ▼                          │
         setInterval(3000ms) ─────────────┤ Repeats every 3 seconds
                │                          │
                ▼                          │
         sendHeartbeat() ─────────────────┘
                │
                ├─ Check _isConnected ───────┐
                ├─ Check _socket exists ─────┤ If any fail:
                ├─ Check readyState === OPEN ┤ → Log warning
                │                             │ → Return early
                ▼                             │
           All checks pass ◄──────────────────┘
                │
                ▼
         try {
             Create heartbeat message
             │
             ├─ rover_id
             ├─ timestamp
             ├─ status: 'alive'
             └─ is_navigating (NEW!)
             │
             ▼
         Send via WebSocket
             │
             ▼
         Update _lastHeartbeat
             │
             ▼
         Reset _heartbeatErrors = 0
             │
             ▼
         Log success ✓
         
         } catch (error) {
             │
             ▼
         Increment _heartbeatErrors
             │
             ▼
         Log error ✗
             │
             ▼
         If _heartbeatErrors >= 5
             │
             └──> stopHeartbeat()
                       │
                       ▼
                  clearInterval()
                       │
                       ▼
                  Log stopped

When user disconnects:
         │
         ▼
   disconnect() called
         │
         └─ stopHeartbeat()
                │
                └─ clearInterval()


┌─────────────────────────────────────────────────────────────┐
│                    Heartbeat States                          │
└─────────────────────────────────────────────────────────────┘

State 1: HEALTHY
├─ Heartbeat sending every 3 seconds
├─ _heartbeatErrors = 0
└─ Console: [Heartbeat] ✓ Sent heartbeat...

State 2: TEMPORARY ISSUE
├─ WebSocket temporarily unavailable
├─ Logs warnings, keeps trying
└─ Console: [Heartbeat] Cannot send heartbeat...

State 3: RECOVERING
├─ Connection restored
├─ Heartbeat resumes
├─ Error count resets
└─ Console: [Heartbeat] ✓ Sent heartbeat...

State 4: CRITICAL FAILURE
├─ 5 consecutive errors
├─ Heartbeat stopped to prevent spam
├─ Requires manual reconnection
└─ Console: [Heartbeat] Too many errors, stopping...
```

### Example Console Output (Normal Operation)

```
[Heartbeat] Starting heartbeat for rover rover-123
[Heartbeat] ✓ Sent heartbeat for rover rover-123 (navigating=false)
[Heartbeat] ✓ Sent heartbeat for rover rover-123 (navigating=false)
[Heartbeat] ✓ Sent heartbeat for rover rover-123 (navigating=true)
[Heartbeat] ✓ Sent heartbeat for rover rover-123 (navigating=true)
```

### Example Console Output (Connection Issues)

```
[Heartbeat] Starting heartbeat for rover rover-123
[Heartbeat] ✓ Sent heartbeat for rover rover-123 (navigating=true)
[Heartbeat] Cannot send heartbeat for rover rover-123: Not connected (socket=true, connected=false)
[Heartbeat] Cannot send heartbeat for rover rover-123: WebSocket not ready (state=0)
[Heartbeat] ✓ Sent heartbeat for rover rover-123 (navigating=true)
```

### Example Console Output (Persistent Failure)

```
[Heartbeat] Starting heartbeat for rover rover-123
[Heartbeat] ✗ Failed to send heartbeat for rover rover-123 (error #1): Error: ...
[Heartbeat] ✗ Failed to send heartbeat for rover rover-123 (error #2): Error: ...
[Heartbeat] ✗ Failed to send heartbeat for rover rover-123 (error #3): Error: ...
[Heartbeat] ✗ Failed to send heartbeat for rover rover-123 (error #4): Error: ...
[Heartbeat] ✗ Failed to send heartbeat for rover rover-123 (error #5): Error: ...
[Heartbeat] Too many heartbeat errors (5), stopping heartbeat for rover rover-123
[Heartbeat] Stopping heartbeat for rover rover-123
```

## Heartbeat Configuration

**Frequency:** Every 3 seconds (3000ms)
```typescript
setInterval(() => {
    this.sendHeartbeat();
}, 3000);
```

**Topic:** `/heartbeat`
```typescript
topic: ROS2_CONFIG.TOPICS.ROVER_HEARTBEAT
```

**Message Format:**
```json
{
  "op": "publish",
  "topic": "/heartbeat",
  "msg": {
    "data": "{\"rover_id\":\"rover-123\",\"timestamp\":1696118400000,\"status\":\"alive\",\"is_navigating\":true}"
  }
}
```

## Testing the Heartbeat

### 1. Open Browser DevTools Console

Look for heartbeat messages:
```
Filter by: [Heartbeat]
```

### 2. Check ROS Side

On the Raspberry Pi, subscribe to the heartbeat topic:
```bash
ros2 topic echo /heartbeat
```

You should see messages every 3 seconds:
```yaml
data: '{"rover_id":"rover-123","timestamp":1696118400000,"status":"alive","is_navigating":true}'
---
data: '{"rover_id":"rover-123","timestamp":1696118403000,"status":"alive","is_navigating":true}'
---
```

### 3. Test Connection Loss

1. Disconnect from the rover
2. Check console for warnings:
   ```
   [Heartbeat] Cannot send heartbeat for rover rover-123: Not connected
   ```
3. Reconnect
4. Heartbeat should resume automatically

### 4. Monitor During Navigation

1. Launch the rover with waypoints
2. Watch console logs
3. Verify `is_navigating=true` in heartbeat messages
4. Stop the rover
5. Verify `is_navigating=false` in subsequent heartbeats

## Troubleshooting

### Heartbeat Not Starting

**Check:**
1. Is `connect()` being called?
2. Is the WebSocket connection successful?
3. Check console for `[Heartbeat] Starting heartbeat...` message

**Solution:**
- Ensure rover is reachable at configured IP
- Check network connectivity
- Verify ROS Bridge is running on the rover

### Heartbeat Stops After a While

**Check:**
1. Console for error messages
2. WebSocket connection state
3. Error count in logs

**Solution:**
- Check network stability
- Verify ROS Bridge is still running
- Check for rover-side errors

### Heartbeat Shows "Not Connected"

**Check:**
1. `_isConnected` state
2. WebSocket readyState
3. Connection lifecycle

**Solution:**
- Verify WebSocket `onopen` event fired
- Check for connection errors
- Try reconnecting

## Benefits of Improvements

1. ✅ **Full Visibility**: Every heartbeat action is logged
2. ✅ **Error Recovery**: Automatically stops after persistent failures
3. ✅ **State Awareness**: Includes navigation state in heartbeat
4. ✅ **Easy Debugging**: Clear, prefixed log messages
5. ✅ **Robust**: Handles connection issues gracefully
6. ✅ **No Silent Failures**: All issues are logged

## Future Enhancements

Potential improvements for the future:

1. **Adaptive Heartbeat Frequency**: Slower when idle, faster when navigating
2. **Exponential Backoff**: Gradually reduce frequency on errors
3. **Heartbeat Response**: Rover acknowledges heartbeat receipt
4. **Connection Quality Metrics**: Track heartbeat latency and success rate
5. **Auto-Reconnect**: Attempt reconnection after heartbeat failures

## Code Changes Summary

**Files Modified:**
- `/src/lib/ros2CommandCentre.ts`

**Lines Changed:**
- Added `_heartbeatErrors` property
- Enhanced `startHeartbeat()` with logging
- Enhanced `stopHeartbeat()` with logging  
- Completely rewrote `sendHeartbeat()` with:
  - Connection state validation
  - WebSocket readiness check
  - Try-catch error handling
  - Comprehensive logging
  - Error tracking and recovery
  - Navigation state in message

**Total Changes:** ~60 lines modified/added

---

**Note:** The heartbeat will continue sending as long as the connection is active. It automatically starts when connecting and stops when disconnecting or when too many errors occur.
