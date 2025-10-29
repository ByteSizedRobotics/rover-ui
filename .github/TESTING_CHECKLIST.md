# Testing Checklist - Manual Control Refactor

## Pre-Testing Setup

- [ ] Rover is powered on and connected to network
- [ ] ROS2 nodes are running on the rover
- [ ] WebRTC server is running for video feed
- [ ] Development server is running (`npm run dev`)

---

## Rovers Page (`/rovers/[id]`)

### Lidar Visualization

- [ ] Navigate to `/rovers/[rover-id]`
- [ ] Lidar canvas displays and shows point cloud
- [ ] Points update in real-time (movement visible)
- [ ] Canvas renders correctly (rover at center, forward = top)
- [ ] Color gradient works (red = close, green = far)
- [ ] Distance rings are visible (0.5m increments).

### Connection Status

- [ ] "Connected" status shows when connected
- [ ] Connection status updates in UI
- [ ] Page loads without errors

### Console Check

- [ ] No duplicate subscription messages in browser console
- [ ] No WebSocket errors
- [ ] Check ROS bridge logs: only ONE subscription to `/scan`

---

## Manual Control Page (`/manual-ctrl/[id]`)

### Connection & UI

- [ ] Navigate to `/manual-ctrl/[rover-id]`
- [ ] "Connecting..." status appears
- [ ] "Connected" status appears after connection
- [ ] Video feed appears and streams
- [ ] No console errors on page load

### Lidar Visualization

- [ ] Lidar canvas displays point cloud
- [ ] Points update in real-time
- [ ] Visualization matches movement
- [ ] Canvas sizing is correct
- [ ] No flickering or performance issues

### Obstacle Detection

- [ ] "Clear Path" shows when no obstacles
- [ ] "Obstacle Detected!" shows when obstacle present
- [ ] Distance value updates correctly
- [ ] Distance shows in meters with 2 decimal places
- [ ] Status color changes (blue = clear, red = detected)

### Motor Controls - Keyboard

- [ ] Press `W` or `↑` - rover moves forward
- [ ] Press `S` or `↓` - rover moves backward
- [ ] Press `A` or `←` - rover turns left
- [ ] Press `D` or `→` - rover turns right
- [ ] Press `Space` or `Q` - rover stops
- [ ] Release key - rover stops automatically
- [ ] Controls disabled when not connected

### Motor Controls - UI Buttons

- [ ] Click ↑ button - rover moves forward
- [ ] Click ↓ button - rover moves backward
- [ ] Click ← button - rover turns left
- [ ] Click → button - rover turns right
- [ ] Click STOP button - rover stops immediately
- [ ] Release button - rover stops (except STOP)
- [ ] Buttons disabled when not connected
- [ ] Button hover/active states work

### Command Log

- [ ] Log shows connection messages
- [ ] Log shows commands sent
- [ ] Log updates in real-time
- [ ] Timestamps are correct
- [ ] Log scrolls (max 10 entries)
- [ ] "No commands sent yet" shows when empty

### Console Check

- [ ] No duplicate subscription messages
- [ ] No WebSocket errors
- [ ] Motor commands are being sent
- [ ] Check ROS bridge logs: only ONE subscription to `/scan`
- [ ] Check ROS bridge logs: motor commands are received

---

## Cross-Page Testing

### Navigation Between Pages

- [ ] Start on rovers page
- [ ] Verify lidar working
- [ ] Navigate to manual control page
- [ ] Verify lidar still working (no reconnection needed)
- [ ] Navigate back to rovers page
- [ ] Verify lidar still working
- [ ] No duplicate connections in console

### Multiple Rover Support

- [ ] Open `/rovers/rover-1`
- [ ] Open `/manual-ctrl/rover-1` in new tab
- [ ] Both should share same connection
- [ ] Open `/rovers/rover-2` in third tab (if you have rover-2)
- [ ] Should create separate connection for rover-2
- [ ] All pages work independently

### Cleanup on Navigation

- [ ] Navigate to manual control
- [ ] Verify connection established
- [ ] Navigate away (to home page)
- [ ] Check console - connection should be cleaned up
- [ ] Navigate back - should reconnect cleanly
- [ ] No memory leaks (check DevTools Memory tab)

---

## Performance Testing

### Network Activity

- [ ] Open DevTools → Network tab → WS filter
- [ ] Should see ONE WebSocket per rover
- [ ] Check messages: no duplicate subscriptions
- [ ] Message rate is reasonable (not flooding)

### CPU/Memory

- [ ] Open DevTools → Performance tab
- [ ] Monitor while using the app
- [ ] CPU usage should be reasonable
- [ ] Memory should be stable (no leaks)
- [ ] Canvas rendering should be smooth (no janky frames)

### Console Warnings/Errors

- [ ] No TypeScript errors
- [ ] No React/Svelte warnings
- [ ] No WebSocket errors
- [ ] No unhandled promise rejections

---

## ROS Bridge Verification

### Check ROS Bridge Logs

```bash
# SSH into rover
ssh rover@<rover-ip>

# Check rosbridge logs
journalctl -u rosbridge -f

# OR if running manually
# Look at terminal output where rosbridge is running
```

**Expected Log Entries:**

- [ ] One client connection per rover
- [ ] One `/scan` subscription per rover (not per page!)
- [ ] One `/obstacle_detected` subscription per rover
- [ ] One `/obstacle_distance` subscription per rover
- [ ] Motor command messages when driving

**Red Flags:**

- ❌ Multiple subscriptions to same topic from same client
- ❌ Subscriptions not cleaning up on page close
- ❌ WebSocket errors or disconnections

---

## Edge Cases

### Connection Failures

- [ ] Turn off rover WiFi
- [ ] Verify "Connection failed" status
- [ ] Turn on rover WiFi
- [ ] Click "Connect" button
- [ ] Should reconnect successfully

### Slow Connection

- [ ] Simulate slow network (DevTools → Network → Slow 3G)
- [ ] Page should still load
- [ ] Connection timeout should be reasonable
- [ ] Error messages should be clear

### Page Refresh

- [ ] On manual control page, refresh browser
- [ ] Should reconnect automatically
- [ ] Video feed should restore
- [ ] Lidar should restore
- [ ] Controls should work immediately

### Browser Back Button

- [ ] Navigate to manual control
- [ ] Use browser back button
- [ ] Connection should clean up
- [ ] Navigate forward again
- [ ] Should reconnect cleanly

---

## Regression Testing

### Video Feed (Should Still Work)

- [ ] Video displays on manual control page
- [ ] Video is smooth (no stuttering)
- [ ] WebRTC connection is stable
- [ ] Video survives page navigation

### Motor Commands (Should Still Work)

- [ ] All movement commands work
- [ ] Speed is appropriate
- [ ] Stop command is responsive
- [ ] No command lag

---

## Final Verification

### Code Quality

- [ ] No TypeScript errors (`npm run check`)
- [ ] No linting errors (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] No console warnings in production build

### Documentation

- [ ] Updated LIDAR_INTEGRATION.md is clear
- [ ] MANUAL_CONTROL_REFACTOR.md is accurate
- [ ] ARCHITECTURE_COMPARISON.md makes sense
- [ ] Code comments are helpful

---

## Sign Off

**Tested By:** ********\_\_\_********  
**Date:** ********\_\_\_********  
**All Tests Passed:** [ ] Yes [ ] No  
**Issues Found:** ********\_\_\_********  
**Notes:** ********\_\_\_********

---

## Troubleshooting Common Issues

### Lidar Not Showing

1. Check browser console for errors
2. Verify ROS2 Command Center is connected
3. Check if `/scan` topic is publishing: `ros2 topic echo /scan`
4. Verify canvas element exists in DOM

### Motor Commands Not Working

1. Check if rover controller is connected (separate from command center)
2. Verify motor command topic is correct
3. Check ROS bridge is receiving commands
4. Verify motors are enabled on rover

### Obstacle Detection Stuck

1. Check if obstacle topics are publishing
2. Verify `commandCenterClient.obstacleData` is being read
3. Check ROS2 nodes are running: `ros2 node list`
4. Restart obstacle detection node if needed

### Performance Issues

1. Check CPU usage in DevTools
2. Verify only one WebSocket per rover
3. Reduce lidar point stride if needed (`pointStride: 5`)
4. Check for memory leaks (navigating between pages)

### Connection Cleanup Not Working

1. Check `onDestroy` is being called
2. Verify `disconnect()` is called on cleanup
3. Check for lingering event listeners
4. Look for unclosed WebSocket connections in DevTools
