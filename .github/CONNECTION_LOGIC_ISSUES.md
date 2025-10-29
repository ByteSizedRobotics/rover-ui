# Connection Logic Issues Analysis

## Issues Found with `_isConnected` Variable

### ❌ Issue 1: `_isConnected` Not Set to False on Error

**Location:** `connect()` method - `onerror` handler

**Problem:**

```typescript
this._socket.onerror = (error) => {
	this._connectionErrors++;
	console.error('ROS2 Command Center connection error:', error);
	this.notifyStateChange();
	reject(new Error('Failed to connect to ROS2 Command Center'));
	// ❌ _isConnected is NOT set to false here!
};
```

**Impact:**

- If an error occurs during connection, `_isConnected` remains `false` (which is correct initially)
- BUT if an error occurs on an already-open connection, `_isConnected` might still be `true`
- The `onerror` event can fire even when connection is supposedly "open"
- This creates an inconsistent state where `_isConnected = true` but connection is broken

**Scenario:**

```
1. connect() called → _isConnected = false
2. WebSocket opens → _isConnected = true
3. Network issue → onerror fires
4. _isConnected still = true ❌ (WRONG!)
5. Heartbeat thinks it's connected and tries to send
6. Heartbeat fails silently
```

---

### ❌ Issue 2: Race Condition Between `onerror` and `onclose`

**Problem:**
When a WebSocket error occurs, BOTH `onerror` and `onclose` events fire, but in an undefined order.

**Current Code:**

```typescript
this._socket.onerror = (error) => {
    // Doesn't set _isConnected = false
    reject(new Error(...));
};

this._socket.onclose = () => {
    this._isConnected = false;  // Only place it's set to false
    this.stopHeartbeat();
};
```

**Impact:**

- If `onerror` fires first, code rejects the promise while `_isConnected` is still `true`
- If `onclose` fires first, code sets `_isConnected = false` then `onerror` fires
- Inconsistent state during the brief window between events
- External code checking `isConnected` getter may see wrong state

---

### ❌ Issue 3: `disconnect()` Sets State Before Closing Socket

**Location:** `disconnect()` method

**Problem:**

```typescript
disconnect(): void {
    this.stopHeartbeat();
    this.disconnectWebRTC();

    if (this._socket) {
        this.unsubscribeFromAllTopics();
        this._socket.close();  // This will trigger onclose event
        this._socket = null;
    }

    this._isConnected = false;  // Set after close() is called
    this.notifyStateChange();
}
```

**Impact:**

- `this._socket.close()` triggers the `onclose` event handler
- The `onclose` handler sets `_isConnected = false`
- Then we set it to `false` again (redundant)
- BUT there's a race: if `onclose` is async or delayed, we might notify state change twice
- The socket is set to `null` but `onclose` handler might still fire and try to access it

**Timeline:**

```
1. disconnect() called
2. this._socket.close() called
3. [async] onclose handler queued
4. this._socket = null
5. this._isConnected = false
6. notifyStateChange() #1
7. [async] onclose handler fires
8. this._isConnected = false (again)
9. notifyStateChange() #2 (duplicate!)
```

---

### ✅ Issue 4: Missing State Reset on Connection Failure During Initial Connection

**Problem:**
If connection fails during the initial `connect()` call:

```typescript
this._socket.onerror = (error) => {
	this._connectionErrors++;
	reject(new Error('Failed to connect'));
	// _isConnected stays false (correct)
	// BUT _socket still exists!
};
```

**Impact:**

- `_socket` object remains in memory even though connection failed
- Next call to `connect()` checks `if (this._isConnected)` but not if socket exists
- Potential memory leak with dangling WebSocket objects
- Could have multiple failed sockets in memory

---

## Recommended Fixes

### Fix 1: Set `_isConnected = false` in `onerror` Handler

```typescript
this._socket.onerror = (error) => {
	this._connectionErrors++;
	this._isConnected = false; // ← ADD THIS
	console.error('ROS2 Command Center connection error:', error);
	this.notifyStateChange();
	reject(new Error('Failed to connect to ROS2 Command Center'));
};
```

### Fix 2: Clean Up Socket on Error

```typescript
this._socket.onerror = (error) => {
	this._connectionErrors++;
	this._isConnected = false;
	console.error('ROS2 Command Center connection error:', error);

	// Clean up the socket
	if (this._socket) {
		this._socket.onclose = null; // Prevent onclose from firing
		this._socket.onerror = null;
		this._socket.onmessage = null;
		this._socket = null;
	}

	this.stopHeartbeat();
	this.notifyStateChange();
	reject(new Error('Failed to connect to ROS2 Command Center'));
};
```

### Fix 3: Improve `disconnect()` to Prevent Duplicate Events

```typescript
disconnect(): void {
    // Set disconnected state FIRST
    const wasConnected = this._isConnected;
    this._isConnected = false;

    this.stopHeartbeat();
    this.disconnectWebRTC();

    if (this._socket) {
        // Remove event handlers to prevent them from firing
        this._socket.onclose = null;
        this._socket.onerror = null;
        this._socket.onmessage = null;
        this._socket.onopen = null;

        // Unsubscribe from all topics
        this.unsubscribeFromAllTopics();

        // Close the socket
        this._socket.close();
        this._socket = null;
    }

    // Only notify if state actually changed
    if (wasConnected) {
        this.notifyStateChange();
    }
}
```

### Fix 4: Improve `connect()` to Check for Existing Socket

```typescript
async connect(): Promise<void> {
    if (this._isConnected && this._socket?.readyState === WebSocket.OPEN) {
        console.log('Already connected');
        return;
    }

    // Clean up any existing socket
    if (this._socket) {
        console.log('Cleaning up existing socket before reconnecting');
        this._socket.onclose = null;
        this._socket.onerror = null;
        this._socket.onmessage = null;
        this._socket.onopen = null;
        this._socket.close();
        this._socket = null;
    }

    this._isConnected = false;  // Ensure clean state

    return new Promise((resolve, reject) => {
        // ... rest of connection logic
    });
}
```

---

## Testing Recommendations

### Test 1: Connection Error

```typescript
// Simulate network error after connection
1. Connect to rover
2. Unplug network cable
3. Check browser console
4. Verify _isConnected becomes false
5. Verify heartbeat stops
```

### Test 2: Rapid Reconnection

```typescript
// Simulate rapid disconnect/reconnect
1. Connect to rover
2. Immediately call disconnect()
3. Immediately call connect() again
4. Verify no duplicate sockets
5. Verify clean connection state
```

### Test 3: Connection Refused

```typescript
// Simulate connection to wrong IP
1. Change IP to invalid address
2. Try to connect
3. Verify _isConnected stays false
4. Verify socket is cleaned up
5. Verify no memory leaks
```

### Test 4: WebSocket State Check

```typescript
// Check WebSocket readyState
1. During connection: readyState should be 0 (CONNECTING)
2. After open: readyState should be 1 (OPEN)
3. During close: readyState should be 2 (CLOSING)
4. After close: readyState should be 3 (CLOSED)
```

---

## WebSocket States Reference

```typescript
enum WebSocketReadyState {
	CONNECTING = 0, // Connection not yet established
	OPEN = 1, // Connection open and ready
	CLOSING = 2, // Connection closing
	CLOSED = 3 // Connection closed or failed
}
```

## Current vs Improved State Management

### Current (Problematic)

```
Connection Error:
├─ onerror fires → reject promise (no state change)
└─ onclose fires → _isConnected = false

Disconnect:
├─ close socket → triggers onclose
├─ onclose sets _isConnected = false
└─ disconnect() sets _isConnected = false (duplicate)

Reconnect:
├─ Check if _isConnected (doesn't check socket)
└─ Create new socket (old socket might exist)
```

### Improved

```
Connection Error:
├─ onerror fires → _isConnected = false, clean up socket
└─ onclose disabled (handlers removed)

Disconnect:
├─ _isConnected = false FIRST
├─ Remove all handlers (prevent events)
├─ Close socket
└─ Single state change notification

Reconnect:
├─ Check _isConnected AND socket state
├─ Clean up old socket if exists
└─ Create new socket with clean state
```

---

## Summary

**Critical Issues:**

1. ❌ `onerror` doesn't set `_isConnected = false`
2. ❌ Race condition between `onerror` and `onclose`
3. ❌ `disconnect()` causes duplicate events
4. ❌ No cleanup of failed sockets

**Recommended Actions:**

1. ✅ Set `_isConnected = false` in `onerror` handler
2. ✅ Remove event handlers before closing socket
3. ✅ Clean up socket on error
4. ✅ Check both `_isConnected` and socket state
5. ✅ Prevent duplicate state notifications

These fixes will ensure `_isConnected` always accurately reflects the actual connection state!
