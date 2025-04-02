<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { RoverController } from './manualControl';
  
  // Create controller with update callback
  let controller: RoverController;
  let component: any;
  let connecting = false;
  
  // Use reactive statements to access controller state
  $: isConnected = controller?.isConnected || false;
  $: connectionStatus = controller?.connectionStatus || "Disconnected";
  $: statusColor = controller?.statusColor || "text-red-500";
  $: logs = controller?.logs || [];
  $: obstacleDetected = controller?.obstacleDetected || false;
  $: obstacleDistance = controller?.obstacleDistance || 0; // Ensure obstacleDistance is treated as a number
  
  // Initialize the controller when component mounts
  onMount(() => {
    // Create controller with callback and custom ROS config if needed
    controller = new RoverController(() => {
      // This callback forces Svelte to update when controller state changes
      component = component;
      
      // TODO: YOU NEED TO PUT THE VARS in here to Force update of reactive variables when controller state changes
      obstacleDetected = controller.obstacleDetected;
      obstacleDistance = controller.obstacleDistance;
      logs = controller.logs;
    });
    
    // Add keyboard event listeners for both arrow keys and WASD
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Auto-connect to ROS node
    connectToRover();
    
    return () => { // CLEANUP AFTER MOVING AWAY FROM THIS PAGE
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      
      // Disconnect when component is destroyed
      if (controller?.isConnected) {
        controller.disconnectFromRover();
      }
    };
  });
  
  // Helper functions to delegate to controller
  const handleKeyDown = (event: KeyboardEvent) => controller.handleKeyDown(event);
  const handleKeyUp = (event: KeyboardEvent) => controller.handleKeyUp(event);
  const handleUIBtnPress = (direction: string) => {
    controller.handleButtonPress(direction);
  };
  const handleUIBtnRelease = () => {
    controller.handleButtonRelease();
  };

  const connectToRover = async () => {
    connecting = true;

    // Force immediate UI update to show "Connecting..." state
    connectionStatus = "Connecting...";
    statusColor = "text-yellow-500";
    try {
      await controller.connectToRover();
      // Initialize lidar visualization once connected
      controller.initLidarVisualization("lidarCanvas");
    } catch (error) {
      console.error("Failed to connect to ROS:", error);
      connectionStatus = "Disconnected";
      statusColor = "text-red-500";

      // Optionally add to logs
      logs = [...controller.logs, {
        time: new Date().toLocaleTimeString(),
        message: "Connection failed: " + (error instanceof Error ? error.message : 'Unknown error')
      }];
    } finally { // if connection successful => means was able to connect to ROS bridge
      if (connectionStatus !== "Disconnected") {
        connectionStatus = "Connected";
        statusColor = "text-green-500";
      }
      connecting = false;
      // isConnected = true;
    }
  };
  
  const disconnectFromRover = async () => {
    try {
      await controller.disconnectFromRover();
    } catch (error) {
      console.error("Failed to disconnect from ROS:", error);
    }
  };
  
  // Movement functions
  const moveForward = () => controller.moveForward();
  const moveBackward = () => controller.moveBackward();
  const moveLeft = () => controller.moveLeft();
  const moveRight = () => controller.moveRight();
  const stopMovement = () => controller.stopMovement();
  
</script>

<div class="min-h-screen bg-gray-100 p-4" bind:this={component}>
  <div class="max-w-5xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
    <div class="p-6">
      <h1 class="text-2xl font-bold text-center mb-6">ROS Rover Control</h1>
      
      <!-- Connection status -->
      <div class="flex justify-between items-center mb-6 p-4 bg-gray-50 rounded-lg">
        <div>
          <span class="font-semibold">Status:</span>
          <span class={statusColor}> {connectionStatus}</span>
        </div>
        {#if !isConnected}
          <button on:click={connectToRover} disabled={connecting} class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-blue-300">
            {connecting ? 'Connecting...' : 'Connect'}
          </button>
        {/if}
      </div>
      
      <!-- Main content with control pad, video stream, and lidar visualization -->
      <div class="flex flex-col space-y-6">
        <!-- Control Pad and Video Section -->
        <div class="flex space-x-6">
          <!-- Control Pad Section (Left side) -->
          <div class="w-1/3 flex flex-col items-center">
            <div class="mb-8">
              <div class="flex justify-center mb-4">
                <button 
                  on:mousedown={() => handleUIBtnPress("forward")}
                  on:mouseup={handleUIBtnRelease}
                  on:mouseleave={handleUIBtnRelease}
                  disabled={!isConnected}
                  class="w-16 h-16 flex items-center justify-center bg-gray-200 rounded-lg text-2xl hover:bg-gray-300 active:bg-gray-400"
                >
                  ↑
                </button>
              </div>
              
              <div class="flex justify-center items-center gap-4">
                <button 
                  on:mousedown={() => handleUIBtnPress("left")}
                  on:mouseup={handleUIBtnRelease}
                  on:mouseleave={handleUIBtnRelease}
                  disabled={!isConnected}
                  class="w-16 h-16 flex items-center justify-center bg-gray-200 rounded-lg text-2xl hover:bg-gray-300 active:bg-gray-400"
                >
                  ←
                </button>
                
                <button 
                  on:mousedown={() => handleUIBtnPress("stop")}
                  disabled={!isConnected}
                  class="w-16 h-16 flex items-center justify-center bg-red-200 rounded-lg text-sm font-bold hover:bg-red-300 active:bg-red-400"
                >
                  STOP
                </button>
                
                <button 
                  on:mousedown={() => handleUIBtnPress("right")}
                  on:mouseup={handleUIBtnRelease}
                  on:mouseleave={handleUIBtnRelease}
                  disabled={!isConnected}
                  class="w-16 h-16 flex items-center justify-center bg-gray-200 rounded-lg text-2xl hover:bg-gray-300 active:bg-gray-400"
                >
                  →
                </button>
              </div>
              
              <div class="flex justify-center mt-4">
                <button 
                  on:mousedown={() => handleUIBtnPress("backward")}
                  on:mouseup={handleUIBtnRelease}
                  on:mouseleave={handleUIBtnRelease}
                  disabled={!isConnected}
                  class="w-16 h-16 flex items-center justify-center bg-gray-200 rounded-lg text-2xl hover:bg-gray-300 active:bg-gray-400"
                >
                  ↓
                </button>
              </div>
            </div>
          </div>
          
          <!-- Video Stream Section (Right side) -->
          <div class="w-2/3 bg-gray-100 rounded-lg overflow-hidden">
            <video 
              id="roverVideo" 
              autoplay 
              playsinline 
              class="w-full h-full object-cover"
              style="max-height: 360px;"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
        
        <!-- Lidar Visualization and Obstacle Detection Information -->
        <div class="flex space-x-6">
          <!-- Obstacle Detection Information (Left side) -->
          <div class="w-1/3 bg-gray-100 rounded-lg p-4">
            <h2 class="text-xl font-semibold mb-4">Obstacles Forward Corridor</h2>
            <div class="flex flex-col space-y-4">
              <div class="flex items-center">
                <span class="font-medium mr-2">Status:</span>
                <span class={obstacleDetected ? "text-red-500 font-bold" : "text-green-500 font-bold"}>
                  {obstacleDetected ? "Obstacle Detected!" : "Clear Path"}
                </span>
              </div>
              <div class="flex items-center">
                <span class="font-medium mr-2">Distance:</span>
                {#if obstacleDetected}
                <span class="text-red-500 font-bold">
                  {obstacleDistance.toFixed(2)} meters
                </span>
                {:else}
                <span class="text-gray-500 italic">
                  No obstacles detected
                </span>
                {/if}
              </div>
            </div>
            
            <!-- Command Log -->
            <div class="mt-6">
              <h3 class="font-bold mb-2">Command Log:</h3>
              <div class="h-40 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50">
                {#if logs.length === 0}
                  <p class="text-gray-500 italic">No commands sent yet.</p>
                {:else}
                  {#each logs as log}
                    <div class="mb-1 text-sm">
                      <span class="text-gray-500">[{log.time}]</span> {log.message}
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          </div>
          
          <!-- Lidar Visualization (Right side) -->
          <div class="w-2/3 bg-gray-100 rounded-lg overflow-hidden">
            <div class="p-2 bg-gray-200">
              <h2 class="text-xl font-semibold">Lidar Point Cloud</h2>
            </div>
            <div class="w-full h-64 relative">
              <canvas 
                id="lidarCanvas" 
                class="w-full h-full"
              >
                Your browser does not support the canvas element.
              </canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>