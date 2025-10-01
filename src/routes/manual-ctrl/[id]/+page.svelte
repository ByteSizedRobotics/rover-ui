<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { RoverController } from './manualControl';
	import { createMiniLidar, type LidarMiniController } from '../../rovers/[id]/lidarController';
	import { commandCenterManager, type ROS2CommandCentreClient } from '$lib/ros2CommandCentre';

	// Create controller with update callback
	const params = get(page).params;
	const roverId = params.id;
	
	let controller: RoverController;
	let component: any;
	let connecting = false;
	
	// Lidar visualization
	let lidarController: LidarMiniController | null = null;
	let commandCenterClient: ROS2CommandCentreClient | null = null;
	
	// Obstacle detection state
	let obstacleDetected = $state(false);
	let obstacleDistance = $state(0);

	// Use reactive statements to access controller state
	$: isConnected = controller?.isConnected || false;
	$: connectionStatus = controller?.connectionStatus || 'Disconnected';
	$: statusColor = controller?.statusColor || 'text-red-500';
	$: logs = controller?.logs || [];

	// Initialize the controller when component mounts
	onMount(() => {
		// Create controller with callback and custom ROS config if needed
		controller = new RoverController(() => {
			// This callback forces Svelte to update when controller state changes
			component = component;

			// Force update of reactive variables when controller state changes
			logs = controller.logs;
			isConnected = controller.isConnected;
			connectionStatus = controller.connectionStatus;
			statusColor = controller.statusColor;
		});

		// Add keyboard event listeners for both arrow keys and WASD
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);

		// Auto-connect to ROS node
		connectToRover();
		
		// Initialize lidar visualization with command center
		if (browser) {
			setTimeout(() => {
				// Create lidar visualization controller
				lidarController = createMiniLidar({ canvas: 'lidarCanvas' });
				
				// Get command center client for this rover
				commandCenterClient = commandCenterManager.getClient(roverId);
				
				// Connect to ROS2 command center for sensor data
				commandCenterClient.connect().then(() => {
					console.log('Connected to ROS2 Command Center for sensor data');
					
					// Subscribe to lidar data updates and feed them to the controller
					commandCenterClient.onLidarData((lidarData) => {
						if (lidarController) {
							lidarController.updateData(lidarData);
						}
					});
					
					// Subscribe to obstacle detection data
					setInterval(() => {
						const obstacleData = commandCenterClient?.obstacleData;
						if (obstacleData) {
							obstacleDetected = obstacleData.detected;
							obstacleDistance = obstacleData.distance;
						}
					}, 100);
				}).catch((err) => {
					console.error('Failed to connect to ROS2 Command Center:', err);
				});
			}, 100);
		}

		return () => {
			// CLEANUP AFTER MOVING AWAY FROM THIS PAGE
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);

			// Disconnect when component is destroyed
			if (controller?.isConnected) {
				controller.disconnectFromRover();
			}
			
			// Clean up command center client
			if (commandCenterClient) {
				commandCenterClient.disconnect();
				commandCenterClient = null;
			}
			
			lidarController = null;
		};
	});

	// Helper functions to delegate to controller
	const handleKeyDown = (event: KeyboardEvent) => controller.handleKeyDown(event);
	const handleKeyUp = (event: KeyboardEvent) => controller.handleKeyUp(event);

	// Updated UI button handlers - directly call movement functions
	const handleDirectionPress = (direction: string) => {
		if (!controller || !isConnected) return;

		switch (direction) {
			case 'forward':
				controller.moveForward();
				break;
			case 'backward':
				controller.moveBackward();
				break;
			case 'left':
				controller.moveLeft();
				break;
			case 'right':
				controller.moveRight();
				break;
			case 'stop':
				controller.stopMovement();
				break;
		}
	};

	const handleDirectionRelease = () => {
		if (controller && isConnected) {
			controller.stopMovement();
		}
	};

	const connectToRover = async () => {
		connecting = true;

		// Force immediate UI update to show "Connecting..." state
		connectionStatus = 'Connecting...';
		statusColor = 'text-yellow-500';
		try {
			await controller.connectToRover();
		} catch (error) {
			console.error('Failed to connect to ROS:', error);
			connectionStatus = 'Disconnected';
			statusColor = 'text-red-500';

			// Optionally add to logs
			logs = [
				...controller.logs,
				{
					time: new Date().toLocaleTimeString(),
					message:
						'Connection failed: ' + (error instanceof Error ? error.message : 'Unknown error')
				}
			];
		} finally {
			// if connection successful => means was able to connect to ROS bridge
			if (connectionStatus !== 'Disconnected') {
				connectionStatus = 'Connected';
				statusColor = 'text-green-500';
			}
			connecting = false;
		}
	};

	const disconnectFromRover = async () => {
		try {
			await controller.disconnectFromRover();
		} catch (error) {
			console.error('Failed to disconnect from ROS:', error);
		}
	};
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4" bind:this={component}>
	<div class="mx-auto max-w-5xl overflow-hidden rounded-2xl bg-white shadow-lg border border-blue-100">
		<div class="p-6">
			<h1 class="mb-6 text-center text-2xl font-bold text-blue-900">ROS Rover Control</h1>

			<!-- Connection status -->
			<div class="mb-6 flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 p-4">
				<div>
					<span class="font-semibold text-blue-900">Status:</span>
					<span class={statusColor}> {connectionStatus}</span>
				</div>
				{#if !isConnected}
					<button
						on:click={connectToRover}
						disabled={connecting}
						class="rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600 disabled:bg-blue-300"
					>
						{connecting ? 'Connecting...' : 'Connect'}
					</button>
				{/if}
			</div>

			<!-- Main content with control pad, video stream, and lidar visualization -->
			<div class="flex flex-col space-y-6">
				<!-- Control Pad and Video Section -->
				<div class="flex space-x-6">
					<!-- Control Pad Section (Left side) -->
					<div class="flex w-1/3 flex-col items-center">
						<div class="mb-8">
							<div class="mb-4 flex justify-center">
								<button
									on:mousedown={() => handleDirectionPress('forward')}
									on:mouseup={handleDirectionRelease}
									on:mouseleave={handleDirectionRelease}
									on:touchstart={() => handleDirectionPress('forward')}
									on:touchend={handleDirectionRelease}
									disabled={!isConnected}
									class="flex h-16 w-16 items-center justify-center rounded-lg bg-blue-100 border border-blue-300 text-2xl hover:bg-blue-200 active:bg-blue-300 text-blue-600 disabled:opacity-50"
								>
									↑
								</button>
							</div>

							<div class="flex items-center justify-center gap-4">
								<button
									on:mousedown={() => handleDirectionPress('left')}
									on:mouseup={handleDirectionRelease}
									on:mouseleave={handleDirectionRelease}
									on:touchstart={() => handleDirectionPress('left')}
									on:touchend={handleDirectionRelease}
									disabled={!isConnected}
									class="flex h-16 w-16 items-center justify-center rounded-lg bg-blue-100 border border-blue-300 text-2xl hover:bg-blue-200 active:bg-blue-300 text-blue-600 disabled:opacity-50"
								>
									←
								</button>

								<button
									on:mousedown={() => handleDirectionPress('stop')}
									on:touchstart={() => handleDirectionPress('stop')}
									disabled={!isConnected}
									class="flex h-16 w-16 items-center justify-center rounded-lg bg-red-200 border border-red-300 text-sm font-bold hover:bg-red-300 active:bg-red-400 text-red-700 disabled:opacity-50"
								>
									STOP
								</button>

								<button
									on:mousedown={() => handleDirectionPress('right')}
									on:mouseup={handleDirectionRelease}
									on:mouseleave={handleDirectionRelease}
									on:touchstart={() => handleDirectionPress('right')}
									on:touchend={handleDirectionRelease}
									disabled={!isConnected}
									class="flex h-16 w-16 items-center justify-center rounded-lg bg-blue-100 border border-blue-300 text-2xl hover:bg-blue-200 active:bg-blue-300 text-blue-600 disabled:opacity-50"
								>
									→
								</button>
							</div>

							<div class="mt-4 flex justify-center">
								<button
									on:mousedown={() => handleDirectionPress('backward')}
									on:mouseup={handleDirectionRelease}
									on:mouseleave={handleDirectionRelease}
									on:touchstart={() => handleDirectionPress('backward')}
									on:touchend={handleDirectionRelease}
									disabled={!isConnected}
									class="flex h-16 w-16 items-center justify-center rounded-lg bg-blue-100 border border-blue-300 text-2xl hover:bg-blue-200 active:bg-blue-300 text-blue-600 disabled:opacity-50"
								>
									↓
								</button>
							</div>
						</div>
					</div>

					<!-- Video Stream Section (Right side) -->
					<div class="w-2/3 overflow-hidden rounded-lg bg-blue-50 border border-blue-200">
						<video
							id="roverVideo"
							autoplay
							playsinline
							class="h-full w-full object-cover"
							style="max-height: 720px;"
						>
							Your browser does not support the video tag.
						</video>
					</div>
				</div>

				<!-- Lidar Visualization and Obstacle Detection Information -->
				<div class="flex space-x-6">
					<!-- Obstacle Detection Information (Left side) -->
					<div class="w-1/3 rounded-lg bg-blue-50 border border-blue-200 p-4">
						<h2 class="mb-4 text-xl font-semibold text-blue-900">Obstacles Forward Corridor</h2>
						<div class="flex flex-col space-y-4">
							<div class="flex items-center">
								<span class="mr-2 font-medium text-blue-700">Status:</span>
								<span
									class={obstacleDetected ? 'font-bold text-red-500' : 'font-bold text-blue-600'}
								>
									{obstacleDetected ? 'Obstacle Detected!' : 'Clear Path'}
								</span>
							</div>
							<div class="flex items-center">
								<span class="mr-2 font-medium text-blue-700">Distance:</span>
								{#if obstacleDetected}
									<span class="font-bold text-red-500">
										{obstacleDistance.toFixed(2)} meters
									</span>
								{:else}
									<span class="italic text-blue-500"> No obstacles detected </span>
								{/if}
							</div>
						</div>

						<!-- Command Log -->
						<div class="mt-6">
							<h3 class="mb-2 font-bold text-blue-900">Command Log:</h3>
							<div class="h-40 overflow-y-auto rounded border border-blue-300 bg-white p-2">
								{#if logs.length === 0}
									<p class="italic text-blue-500">No commands sent yet.</p>
								{:else}
									{#each logs as log}
										<div class="mb-1 text-sm">
											<span class="text-blue-400">[{log.time}]</span>
											<span class="text-blue-700">{log.message}</span>
										</div>
									{/each}
								{/if}
							</div>
						</div>
					</div>

					<!-- Lidar Visualization (Right side) -->
					<div class="w-2/3 overflow-hidden rounded-lg bg-blue-50 border border-blue-200">
						<div class="bg-blue-100 border-b border-blue-200 p-2">
							<h2 class="text-xl font-semibold text-blue-900">Lidar Point Cloud</h2>
						</div>
						<div class="relative h-64 w-full">
							<canvas id="lidarCanvas" class="h-full w-full">
								Your browser does not support the canvas element.
							</canvas>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
