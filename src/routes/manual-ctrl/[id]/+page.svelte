<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { RoverController, type LogEntry } from './manualControl';
	import { createMiniLidar, type LidarMiniController } from '../../rovers/[id]/lidarController';
	import {
		commandCenterManager,
		type ROS2CommandCentreClient,
		type CameraStreamStatus
	} from '$lib/ros2CommandCentre';

	// Create controller with update callback
	const params = get(page).params;
	const roverId: string = params.id ?? '';
	let latestPathId = $state<number | null>(null);

	let controller = $state<RoverController | undefined>(undefined);
	let component: any;
	let connecting = $state(false);

	// Lidar visualization
	let lidarController: LidarMiniController | null = null;
	let commandCenterClient: ROS2CommandCentreClient | null = null;
	let isCSICameraReady = $state(false);
	let isUSBCameraReady = $state(false);
	let isCSI2CameraReady = $state(false);
	let csiStatusMessage = $state('Connecting to CSI camera 1...');
	let usbStatusMessage = $state('Connecting to USB camera...');
	let csi2StatusMessage = $state('Connecting to CSI camera 2...');
	let cleanupWebRTCListener: (() => void) | null = null;

	function updateWebRTCStatus(status: CameraStreamStatus) {
		// Update CSI camera (Camera 1) status
		isCSICameraReady = status.csi.isConnected && status.csi.hasRemoteStream;
		csiStatusMessage = status.csi.isConnected
			? status.csi.hasRemoteStream
				? 'CSI camera 1 connected'
				: 'Connecting to CSI camera 1...'
			: 'CSI camera 1 disconnected';

		// Update USB camera (Camera 2) status
		isUSBCameraReady = status.usb.isConnected && status.usb.hasRemoteStream;
		usbStatusMessage = status.usb.isConnected
			? status.usb.hasRemoteStream
				? 'USB camera connected'
				: 'Connecting to USB camera...'
			: 'USB camera disconnected';

		// Update CSI2 camera (Camera 3) status
		isCSI2CameraReady = status.csi2.isConnected && status.csi2.hasRemoteStream;
		csi2StatusMessage = status.csi2.isConnected
			? status.csi2.hasRemoteStream
				? 'CSI camera 2 connected'
				: 'Connecting to CSI camera 2...'
			: 'CSI camera 2 disconnected';
	}

	// Obstacle detection state
	let obstacleDetected = $state(false);
	let obstacleDistance = $state(0);
	let obstacleInterval: ReturnType<typeof setInterval> | null = null;

	// Controller state - updated via callback
	let isConnected = $state(false);
	let connectionStatus = $state('Disconnected');
	let statusColor = $state('text-red-500');
	let logs = $state<LogEntry[]>([]);

	// Initialize the controller when component mounts
	onMount(async () => {
		// Get the latest path ID from cache or fetch it BEFORE connecting
		const cachedPathId = commandCenterManager.getLatestPathId(roverId);
		if (cachedPathId !== null) {
			latestPathId = cachedPathId;
		} else {
			// Fetch and cache if not available
			latestPathId = await commandCenterManager.fetchAndCacheLatestPathId(roverId);
		}

		// Create controller with callback and custom ROS config if needed
		controller = new RoverController(() => {
			// This callback forces Svelte to update when controller state changes
			if (controller) {
				isConnected = controller.isConnected;
				connectionStatus = controller.connectionStatus;
				statusColor = controller.statusColor;
				logs = controller.logs;
			}
		});

		// Add keyboard event listeners for both arrow keys and WASD
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);

		// Auto-connect to ROS node
		connectToRover();

		// Initialize lidar visualization and video with command center
		if (browser) {
			setTimeout(() => {
				// Create lidar visualization controller
				lidarController = createMiniLidar({ canvas: 'lidarCanvas' });

				// Get command center client for this rover
				commandCenterClient = commandCenterManager.getClient(roverId);
				cleanupWebRTCListener?.();
				cleanupWebRTCListener = commandCenterClient.onWebRTCStatusChange(updateWebRTCStatus);

				const setupCommandCenter = async () => {
					if (!commandCenterClient) {
						return;
					}

					// Set up lidar callback BEFORE checking connection
					commandCenterClient.onLidarData((lidarData) => {
						if (lidarController) {
							lidarController.updateData(lidarData);
						}
					});

					// Set up obstacle detection polling
					if (obstacleInterval) {
						clearInterval(obstacleInterval);
					}
					obstacleInterval = setInterval(() => {
						const obstacleData = commandCenterClient?.obstacleData;
						if (obstacleData) {
							obstacleDetected = obstacleData.detected;
							obstacleDistance = obstacleData.distance ?? 0;
						}
					}, 100);

					try {
						// Connect if not already connected
						const wasAlreadyConnected = commandCenterClient.isConnected;
						if (!wasAlreadyConnected) {
							await commandCenterClient.connect({ enableCSICamera: true, enableUSBCamera: true, enableCSI2Camera: true });
							if (!commandCenterClient) {
								return;
							}
							console.log('Connected to ROS2 Command Center for sensor data and video');
						} else {
							console.log('Already connected to ROS2 Command Center');
						}

						// Set up all three camera video elements
						commandCenterClient.setVideoElement('roverVideoCSI', 'csi');
						commandCenterClient.setVideoElement('roverVideoUSB', 'usb');
						commandCenterClient.setVideoElement('roverVideoCSI2', 'csi2');

						// Enable manual control mode by sending command to ROS2 topic
						try {
							await commandCenterClient.enableManualControl();
							console.log('Manual control mode enabled successfully');
						} catch (error) {
							console.error('Failed to enable manual control mode:', error);
						}
					} catch (err) {
						console.error('Failed to connect to ROS2 Command Center:', err);
					}
				};

				setupCommandCenter();
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
				commandCenterClient.setVideoElement(null, 'csi');
				commandCenterClient.setVideoElement(null, 'usb');
				commandCenterClient.setVideoElement(null, 'csi2');
				commandCenterClient.onLidarData(null);
				commandCenterClient = null;
			}

			if (obstacleInterval) {
				clearInterval(obstacleInterval);
				obstacleInterval = null;
			}

			if (cleanupWebRTCListener) {
				cleanupWebRTCListener();
				cleanupWebRTCListener = null;
			}
			isCSICameraReady = false;
			isUSBCameraReady = false;
			isCSI2CameraReady = false;
			csiStatusMessage = 'Connecting to CSI camera 1...';
			usbStatusMessage = 'Connecting to USB camera...';
			csi2StatusMessage = 'Connecting to CSI camera 2...';

			lidarController = null;
		};
	});

	// Helper functions to delegate to controller
	const handleKeyDown = (event: KeyboardEvent) => controller?.handleKeyDown(event);
	const handleKeyUp = (event: KeyboardEvent) => controller?.handleKeyUp(event);

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
		if (!controller) return;

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
		if (!controller) return;

		try {
			await controller.disconnectFromRover();
		} catch (error) {
			console.error('Failed to disconnect from ROS:', error);
		}
	};
</script>

<div
	class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4"
	bind:this={component}
>
	<div
		class="mx-auto max-w-7xl overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-lg"
	>
		<div class="p-6">
			<h1 class="mb-6 text-center text-2xl font-bold text-blue-900">Manual Control</h1>

			<!-- Connection status -->
			<div
				class="mb-6 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4"
			>
				<div>
					<span class="font-semibold text-blue-900">Status:</span>
					<span class={statusColor}> {connectionStatus}</span>
				</div>
				{#if !isConnected}
					<button
						onclick={connectToRover}
						disabled={connecting}
						class="rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600 disabled:bg-blue-300"
					>
						{connecting ? 'Connecting...' : 'Connect'}
					</button>
				{/if}
			</div>

			<!-- Three Camera Views Section -->
			<div class="mb-6">
				<div class="grid grid-cols-3 gap-4">
					<!-- CSI Camera 1 (Left) -->
					<div class="overflow-hidden rounded-lg border border-blue-200 bg-blue-50">
						<div class="border-b border-blue-200 bg-blue-100 p-2 text-center">
							<h3 class="text-xl font-semibold text-blue-900">CSI Camera 1</h3>
							<!-- <p class="text-xs text-blue-600">{csiStatusMessage}</p> -->
						</div>
						<div class="relative flex items-center justify-center bg-black" style="height: 300px;">
							<video
								id="roverVideoCSI"
								autoplay
								playsinline
								muted
								width="820"
								height="616"
								class="h-full w-full object-contain"
							>
								Your browser does not support the video tag.
							</video>

							<!-- Fallback when no stream is available -->
							{#if !isCSICameraReady}
								<div
									class="absolute inset-0 flex items-center justify-center bg-blue-50 text-center text-blue-600"
								>
									<div>
										<img
											src="/video_cam.png"
											alt="Camera connection placeholder"
											class="mx-auto mb-2 h-12 w-12 object-contain"
											loading="lazy"
										/>
										<p class="text-xs">{csiStatusMessage}</p>
									</div>
								</div>
							{/if}
						</div>
					</div>

					<!-- USB Camera (Middle/Front) -->
					<div class="overflow-hidden rounded-lg border border-blue-200 bg-blue-50">
						<div class="border-b border-blue-200 bg-blue-100 p-2 text-center">
							<h3 class="text-xl font-semibold text-blue-900">USB Camera (Front)</h3>
							<!-- <p class="text-xs text-blue-600">{usbStatusMessage}</p> -->
						</div>
						<div class="relative flex items-center justify-center bg-black" style="height: 300px;">
							<video
								id="roverVideoUSB"
								autoplay
								playsinline
								muted
								width="1280"
								height="720"
								class="h-full w-full object-contain"
							>
								Your browser does not support the video tag.
							</video>

							<!-- Fallback when no stream is available -->
							{#if !isUSBCameraReady}
								<div
									class="absolute inset-0 flex items-center justify-center bg-blue-50 text-center text-blue-600"
								>
									<div>
										<img
											src="/video_cam.png"
											alt="Camera connection placeholder"
											class="mx-auto mb-2 h-12 w-12 object-contain"
											loading="lazy"
										/>
										<p class="text-xs">{usbStatusMessage}</p>
									</div>
								</div>
							{/if}
						</div>
					</div>

					<!-- CSI Camera 2 (Right) -->
					<div class="overflow-hidden rounded-lg border border-blue-200 bg-blue-50">
						<div class="border-b border-blue-200 bg-blue-100 p-2 text-center">
							<h3 class="text-xl font-semibold text-blue-900">CSI Camera 2</h3>
							<!-- <p class="text-xs text-blue-600">{csi2StatusMessage}</p> -->
						</div>
						<div class="relative flex items-center justify-center bg-black" style="height: 300px;">
							<video
								id="roverVideoCSI2"
								autoplay
								playsinline
								muted
								width="820"
								height="616"
								class="h-full w-full object-contain"
							>
								Your browser does not support the video tag.
							</video>

							<!-- Fallback when no stream is available -->
							{#if !isCSI2CameraReady}
								<div
									class="absolute inset-0 flex items-center justify-center bg-blue-50 text-center text-blue-600"
								>
									<div>
										<img
											src="/video_cam.png"
											alt="Camera connection placeholder"
											class="mx-auto mb-2 h-12 w-12 object-contain"
											loading="lazy"
										/>
										<p class="text-xs">{csi2StatusMessage}</p>
									</div>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<!-- Control Section -->
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<!-- Control Pad -->
				<div class="overflow-hidden rounded-lg border border-blue-200 bg-blue-50">
					<div class="border-b border-blue-200 bg-blue-100 p-3 text-center">
						<h3 class="text-xl font-semibold text-blue-900">Controls</h3>
					</div>
					<div class="flex flex-col items-center justify-center p-6">
					<div class="mb-8">
						<div class="mb-4 flex justify-center">
							<button
								onmousedown={() => handleDirectionPress('forward')}
								onmouseup={handleDirectionRelease}
								onmouseleave={handleDirectionRelease}
								ontouchstart={() => handleDirectionPress('forward')}
								ontouchend={handleDirectionRelease}
								disabled={!isConnected}
								class="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-blue-800 bg-blue-600 text-3xl text-white shadow-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								↑
							</button>
						</div>

						<div class="flex items-center justify-center gap-4">
							<button
								onmousedown={() => handleDirectionPress('left')}
								onmouseup={handleDirectionRelease}
								onmouseleave={handleDirectionRelease}
								ontouchstart={() => handleDirectionPress('left')}
								ontouchend={handleDirectionRelease}
								disabled={!isConnected}
								class="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-blue-800 bg-blue-600 text-3xl text-white shadow-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								←
							</button>

							<button
								onmousedown={() => handleDirectionPress('stop')}
								ontouchstart={() => handleDirectionPress('stop')}
								disabled={!isConnected}
								class="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-red-800 bg-red-600 text-lg font-bold text-white shadow-xl hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								STOP
							</button>

							<button
								onmousedown={() => handleDirectionPress('right')}
								onmouseup={handleDirectionRelease}
								onmouseleave={handleDirectionRelease}
								ontouchstart={() => handleDirectionPress('right')}
								ontouchend={handleDirectionRelease}
								disabled={!isConnected}
								class="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-blue-800 bg-blue-600 text-3xl text-white shadow-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								→
							</button>
						</div>

						<div class="mt-4 flex justify-center">
							<button
								onmousedown={() => handleDirectionPress('backward')}
								onmouseup={handleDirectionRelease}
								onmouseleave={handleDirectionRelease}
								ontouchstart={() => handleDirectionPress('backward')}
								ontouchend={handleDirectionRelease}
								disabled={!isConnected}
								class="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-blue-800 bg-blue-600 text-3xl text-white shadow-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								↓
							</button>
						</div>
					</div>

					<!-- Keyboard shortcuts hint -->
					<div class="mt-4 rounded-lg border border-blue-300 bg-white p-3 text-center">
						<p class="text-xs text-blue-700">Use Arrow Keys or WASD to control</p>
					</div>
					</div>
				</div>

				<!-- Obstacle Detection Information -->
				<div class="overflow-hidden rounded-lg border border-blue-200 bg-blue-50">
					<div class="border-b border-blue-200 bg-blue-100 p-3 text-center">
						<h2 class="text-xl font-semibold text-blue-900">Obstacles Forward Corridor</h2>
					</div>
					<div class="flex flex-col space-y-4 p-6">
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
					<div class="p-6 pt-0">
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

				<!-- Lidar Visualization -->
				<div class="overflow-hidden rounded-lg border border-blue-200 bg-blue-50">
					<div class="border-b border-blue-200 bg-blue-100 p-3 text-center">
						<h2 class="text-xl font-semibold text-blue-900">Lidar Point Cloud</h2>
					</div>
					<div class="flex items-center justify-center p-6">
						<canvas 
							id="lidarCanvas" 
							width="300" 
							height="300"
							class="rounded-lg border border-blue-200"
						>
							Your browser does not support the canvas element.
						</canvas>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Fixed back button bottom-left -->
	<div class="bottom-left">
		<button onclick={() => goto(latestPathId ? `/rovers/${roverId}/${latestPathId}` : `/rovers/${roverId}`)} class="back-button">
			← Back to Rover
		</button>
	</div>
</div>

<style>
	/* Fixed back button in bottom-left */
	.bottom-left {
		position: fixed;
		left: 16px;
		bottom: 16px;
		z-index: 1002;
	}

	.back-button {
		display: inline-block;
		padding: 12px 16px;
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		text-decoration: none;
		font-family: inherit;
		font-size: 14px;
		font-weight: 500;
		transition: background-color 0.2s;
		box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
	}

	.back-button:hover {
		background: #2563eb;
		color: white;
	}
</style>
