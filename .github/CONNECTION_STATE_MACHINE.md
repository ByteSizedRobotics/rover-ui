# Connection State Machine - Visual Guide

## Connection State Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                  IMPROVED CONNECTION STATES                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────┐
│  INITIAL    │  _isConnected = false
│  STATE      │  _socket = null
└──────┬──────┘
       │
       │ connect() called
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  CLEANUP PHASE                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ if (_isConnected && _socket?.readyState === OPEN)         │ │
│  │     return (already connected)                             │ │
│  │                                                            │ │
│  │ if (_socket exists)                                        │ │
│  │     ├─ Remove all handlers                                 │ │
│  │     ├─ Close socket                                        │ │
│  │     └─ socket = null                                       │ │
│  │                                                            │ │
│  │ _isConnected = false (ensure clean state)                 │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────┐
│ CONNECTING  │  _isConnected = false
│             │  _socket = new WebSocket(url)
│             │  readyState = 0 (CONNECTING)
└──────┬──────┘
       │
       ├──────────────┬──────────────┐
       │              │              │
       ▼              ▼              ▼
   SUCCESS        ERROR          TIMEOUT
       │              │              │
       │              │              │
       ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  CONNECTED  │ │   FAILED    │ │   FAILED    │
│             │ │             │ │             │
│ onopen()    │ │ onerror()   │ │ onerror()   │
│ ✓ Set true  │ │ ✓ Set false │ │ ✓ Set false │
│ ✓ Subscribe │ │ ✓ Clean up  │ │ ✓ Clean up  │
│ ✓ Heartbeat │ │ ✓ Stop HB   │ │ ✓ Stop HB   │
│ ✓ WebRTC    │ │ ✓ Remove    │ │ ✓ Remove    │
│ ✓ Notify    │ │   handlers  │ │   handlers  │
│ ✓ Resolve   │ │ ✓ Notify    │ │ ✓ Notify    │
│             │ │ ✓ Reject    │ │ ✓ Reject    │
└──────┬──────┘ └─────────────┘ └─────────────┘
       │
       │ Running...
       │
       ├──────────────┬──────────────┐
       │              │              │
   User calls    Network        Socket
   disconnect()   failure        error
       │              │              │
       ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│DISCONNECTING│ │   ERROR     │ │   ERROR     │
│             │ │             │ │             │
│disconnect() │ │ onerror()   │ │ onerror()   │
│ ✓ Set false │ │ ✓ Set false │ │ ✓ Set false │
│   (FIRST!)  │ │ ✓ Clean up  │ │ ✓ Clean up  │
│ ✓ Stop HB   │ │ ✓ Stop HB   │ │ ✓ Stop HB   │
│ ✓ WebRTC    │ │ ✓ Remove    │ │ ✓ Remove    │
│ ✓ Remove    │ │   handlers  │ │   handlers  │
│   handlers  │ │ ✓ Notify    │ │ ✓ Notify    │
│ ✓ Close     │ │             │ │             │
│ ✓ Notify    │ │             │ │             │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │               │
       └───────────────┴───────────────┘
                       │
                       ▼
                ┌─────────────┐
                │DISCONNECTED │
                │             │
                │_isConnected │
                │  = false    │
                │_socket      │
                │  = null     │
                └─────────────┘
```

---

## State Transitions with Conditions

```
┌─────────────────────────────────────────────────────────────────┐
│                  STATE TRANSITION TABLE                          │
├──────────────┬───────────────┬────────────┬─────────────────────┤
│ Current State│ Event         │ Condition  │ Next State          │
├──────────────┼───────────────┼────────────┼─────────────────────┤
│ INITIAL      │ connect()     │ Always     │ CLEANUP → CONNECT   │
├──────────────┼───────────────┼────────────┼─────────────────────┤
│ CONNECTED    │ connect()     │ Already    │ CONNECTED (no-op)   │
│              │               │ open       │                     │
├──────────────┼───────────────┼────────────┼─────────────────────┤
│ CONNECTED    │ connect()     │ Socket     │ CLEANUP → CONNECT   │
│              │               │ exists but │                     │
│              │               │ not open   │                     │
├──────────────┼───────────────┼────────────┼─────────────────────┤
│ CONNECTING   │ onopen        │ Success    │ CONNECTED           │
├──────────────┼───────────────┼────────────┼─────────────────────┤
│ CONNECTING   │ onerror       │ Failed     │ DISCONNECTED        │
├──────────────┼───────────────┼────────────┼─────────────────────┤
│ CONNECTED    │ onerror       │ Network    │ DISCONNECTED        │
│              │               │ issue      │                     │
├──────────────┼───────────────┼────────────┼─────────────────────┤
│ CONNECTED    │ onclose       │ Server     │ DISCONNECTED        │
│              │               │ closed     │                     │
├──────────────┼───────────────┼────────────┼─────────────────────┤
│ CONNECTED    │ disconnect()  │ User       │ DISCONNECTING →     │
│              │               │ action     │ DISCONNECTED        │
├──────────────┼───────────────┼────────────┼─────────────────────┤
│ DISCONNECTED │ connect()     │ Always     │ CLEANUP → CONNECT   │
└──────────────┴───────────────┴────────────┴─────────────────────┘
```

---

## Event Handler Lifecycle

### Before Fixes (Problematic)

```
WebSocket Created
       │
       ├─ onopen   ───► Always set
       ├─ onerror  ───► Always set
       ├─ onclose  ───► Always set
       └─ onmessage ──► Always set
              │
              ▼
       Error occurs
              │
              ├─ onerror fires  ──► Doesn't clean up
              │                     Doesn't set _isConnected=false
              │
              └─ onclose fires  ──► Also fires! (duplicate)
                                    Sets _isConnected=false
                                    Notifies again (duplicate)

       ❌ RESULT: Race conditions, duplicates, wrong state
```

### After Fixes (Correct)

```
WebSocket Created
       │
       ├─ onopen   ───► Always set
       ├─ onerror  ───► Always set, includes cleanup
       ├─ onclose  ───► Always set
       └─ onmessage ──► Always set
              │
              ▼
       Error occurs
              │
              └─ onerror fires
                     │
                     ├─ _isConnected = false ✅
                     ├─ stopHeartbeat() ✅
                     ├─ Remove ALL handlers ✅
                     │  ├─ onclose = null
                     │  ├─ onerror = null
                     │  ├─ onmessage = null
                     │  └─ onopen = null
                     ├─ notifyStateChange() once ✅
                     └─ reject Promise ✅

       onclose does NOT fire (handler removed)

       ✅ RESULT: Clean state, no duplicates, correct behavior
```

---

## Memory Management

### Socket Lifecycle (Before Fixes)

```
connect() #1
    └─ socket #1 created
           │
           └─ Error occurs
                  └─ socket #1 stays in memory ❌

connect() #2
    └─ socket #2 created
           │
           └─ socket #1 still in memory ❌

Result: Memory leak! Multiple sockets!
```

### Socket Lifecycle (After Fixes)

```
connect() #1
    └─ Check: No existing socket
    └─ socket #1 created
           │
           └─ Error occurs
                  └─ onerror cleans up socket #1 ✅
                        └─ socket = null ✅

connect() #2
    └─ Check: No existing socket ✅
    └─ socket #2 created
           └─ Clean state ✅

Result: No memory leaks! Only one socket at a time!
```

---

## Concurrent Operation Handling

### Scenario: Rapid connect/disconnect/connect

```
Time  │ Action          │ Before (❌)         │ After (✅)
──────┼─────────────────┼─────────────────────┼──────────────────────
t=0   │ connect()       │ socket #1 created   │ socket #1 created
      │                 │ connecting...       │ connecting...
──────┼─────────────────┼─────────────────────┼──────────────────────
t=1   │ disconnect()    │ close socket #1     │ _isConnected = false
      │                 │ socket = null       │ remove handlers
      │                 │ onclose fires later │ close socket
      │                 │                     │ socket = null
──────┼─────────────────┼─────────────────────┼──────────────────────
t=2   │ connect()       │ socket #2 created   │ Check: no socket ✅
      │                 │ BUT socket #1       │ socket #2 created
      │                 │ onclose still fires │ clean state
      │                 │ duplicate events! ❌ │ no duplicates ✅
──────┼─────────────────┼─────────────────────┼──────────────────────
t=3   │ onclose #1 fires│ _isConnected=false  │ onclose doesn't fire
      │                 │ notify (duplicate)❌│ (handler removed) ✅
──────┼─────────────────┼─────────────────────┼──────────────────────
t=4   │ onopen #2 fires │ _isConnected=true   │ _isConnected=true
      │                 │ BUT just set false! │ clean transition ✅
      │                 │ confusing state! ❌  │
──────┴─────────────────┴─────────────────────┴──────────────────────
```

---

## State Consistency Checks

### Before Fixes

```javascript
// State can be inconsistent:
_isConnected = true
_socket = null           ❌ INVALID STATE

_isConnected = false
_socket = WebSocket      ❌ COULD BE VALID (connecting)
_socket.readyState = 1   ❌ INVALID (should be connected)

// Heartbeat checks:
if (!_isConnected || !_socket) return;
// But doesn't check socket.readyState ❌
```

### After Fixes

```javascript
// State is always consistent:
_isConnected = true
_socket = WebSocket      ✅ VALID
_socket.readyState = 1   ✅ VALID (OPEN)

_isConnected = false
_socket = null           ✅ VALID

// Connection check:
if (_isConnected && _socket?.readyState === WebSocket.OPEN)
    return; // Already connected
// Checks BOTH state AND socket ✅

// Heartbeat checks:
if (!_isConnected || !_socket) return;
if (_socket.readyState !== WebSocket.OPEN) return;
// Triple validation! ✅
```

---

## Error Recovery Patterns

### Network Disconnection

```
┌──────────────────────────────────────────────────────────────┐
│               NETWORK DISCONNECTION FLOW                      │
└──────────────────────────────────────────────────────────────┘

Connected State
    │
    │ Network cable unplugged
    ▼
onerror fires
    │
    ├─ _isConnected = false ✅
    ├─ stopHeartbeat() ✅
    ├─ Remove handlers ✅
    └─ notifyStateChange() ✅

UI shows "Disconnected"

User reconnects network
    │
    ▼
User clicks "Connect"
    │
    ├─ Check: not connected ✅
    ├─ Clean up: no socket ✅
    └─ Create new connection ✅

Connection restored! ✅
```

### Rapid Reconnection

```
┌──────────────────────────────────────────────────────────────┐
│                  RAPID RECONNECTION FLOW                      │
└──────────────────────────────────────────────────────────────┘

Connected State
    │
    ▼
disconnect() called
    │
    ├─ _isConnected = false ✅
    ├─ Remove handlers ✅
    └─ Close socket ✅

Disconnected (t=0)
    │
    ▼ (t=1ms)
connect() called
    │
    ├─ Check: not connected ✅
    ├─ No existing socket ✅
    └─ Create new connection ✅

New connection established! ✅
No conflicts or duplicates ✅
```

---

## Debugging Tips

### Check Connection State

```javascript
// In browser console:
commandCenterClient.isConnected
// Should match actual connection

commandCenterClient._socket?.readyState
// 0 = CONNECTING
// 1 = OPEN
// 2 = CLOSING
// 3 = CLOSED

// Both should align:
isConnected = true  → readyState = 1 ✅
isConnected = false → socket = null OR readyState = 3 ✅
```

### Monitor State Changes

```javascript
// Add logging:
commandCenterClient.onStateChange(() => {
	console.log('State changed:', {
		isConnected: commandCenterClient.isConnected,
		socketState: commandCenterClient._socket?.readyState,
		hasSocket: !!commandCenterClient._socket
	});
});
```

### Check for Memory Leaks

```javascript
// Before fixes:
// Multiple WebSocket objects stay in memory ❌

// After fixes:
// Only one WebSocket at a time ✅

// To verify:
// 1. Open Chrome DevTools → Memory → Take Heap Snapshot
// 2. Filter by "WebSocket"
// 3. Should see only 1 WebSocket object per rover
```

---

**All connection state management issues resolved!** ✅
