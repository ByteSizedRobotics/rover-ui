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
  
  // Initialize the controller when component mounts
  onMount(() => {
    // Create controller with callback and custom ROS config if needed
    controller = new RoverController(() => {
      // This callback forces Svelte to update when controller state changes
      component = component;
    }, {
      url: "192.168.1.100", // TODO : NATHAN Update with Raspberry Pi IP
      port: 9090,          // TODO: Verify rosbridge WebSocket port
      commandTopic: "/rover_commands",
      lidarTopic: "/scan"
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
  
  const connectToRover = async () => {
    connecting = true;

    // Force immediate UI update to show "Connecting..." state
    connectionStatus = "Connecting...";
    statusColor = "text-yellow-500";
    try {
      await controller.connectToRover();
    } catch (error) {
      console.error("Failed to connect to ROS:", error);
      connectionStatus = "Disconnected";
      statusColor = "text-red-500";

      // Optionally add to logs
      logs = [...controller.logs, {
      time: new Date().toLocaleTimeString(),
      message: "Connection failed: " + (error instanceof Error ? error.message : 'Unknown error')
    }];
    } finally {
      connecting = false;
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
  <div class="max-w-3xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
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
      
      <!-- Control pad -->
      <div class="mb-8">
        <div class="flex justify-center mb-4">
          <button 
            on:mousedown={moveForward}
            on:mouseup={stopMovement}
            on:mouseleave={stopMovement}
            disabled={!isConnected}
            class="w-16 h-16 flex items-center justify-center bg-gray-200 rounded-lg text-2xl {isConnected ? 'hover:bg-gray-300 active:bg-gray-400' : 'opacity-50 cursor-not-allowed'}"
          >
            ↑
          </button>
        </div>
        
        <div class="flex justify-center items-center gap-4">
          <button 
            on:mousedown={moveLeft}
            on:mouseup={stopMovement}
            on:mouseleave={stopMovement}
            disabled={!isConnected}
            class="w-16 h-16 flex items-center justify-center bg-gray-200 rounded-lg text-2xl {isConnected ? 'hover:bg-gray-300 active:bg-gray-400' : 'opacity-50 cursor-not-allowed'}"
          >
            ←
          </button>
          
          <button 
            on:click={stopMovement}
            disabled={!isConnected}
            class="w-16 h-16 flex items-center justify-center bg-red-200 rounded-lg text-sm font-bold {isConnected ? 'hover:bg-red-300 active:bg-red-400' : 'opacity-50 cursor-not-allowed'}"
          >
            STOP
          </button>
          
          <button 
            on:mousedown={moveRight}
            on:mouseup={stopMovement}
            on:mouseleave={stopMovement}
            disabled={!isConnected}
            class="w-16 h-16 flex items-center justify-center bg-gray-200 rounded-lg text-2xl {isConnected ? 'hover:bg-gray-300 active:bg-gray-400' : 'opacity-50 cursor-not-allowed'}"
          >
            →
          </button>
        </div>
        
        <div class="flex justify-center mt-4">
          <button 
            on:mousedown={moveBackward}
            on:mouseup={stopMovement}
            on:mouseleave={stopMovement}
            disabled={!isConnected}
            class="w-16 h-16 flex items-center justify-center bg-gray-200 rounded-lg text-2xl {isConnected ? 'hover:bg-gray-300 active:bg-gray-400' : 'opacity-50 cursor-not-allowed'}"
          >
            ↓
          </button>
        </div>
      </div>
      
      <!-- Command log -->
      <div>
        <h2 class="font-bold mb-2">Command Log:</h2>
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
  </div>
</div>