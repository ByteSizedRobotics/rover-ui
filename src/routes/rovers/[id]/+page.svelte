<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import type { PageServerData } from './$types';
	import { browser } from '$app/environment';
	import { createMiniLidar, LidarMiniController } from './lidarController';
	import { commandCenterManager, type ROS2CommandCentreClient, type WebRTCStatus } from '$lib/ros2CommandCentre';
	import { goto } from '$app/navigation';

	let { data }: { data: PageServerData } = $props();

	// Notification state
	let notification = $state<{
		message: string;
		waypointCount: number;
		show: boolean;
	} | null>(null);

	const params = get(page).params;
	const roverId: string = params.id ?? '';

	// Live metrics state
	let currentCamera = $state(1);
	let sensorData = $state({
		roll: 0,
		pitch: 0,
		yaw: 0,
		temperature: 0,
		batteryVoltage: 0,
		linearVelocity: 0,
		angularVelocity: 0,
		isConnected: false
	});
	type DetectionRow = {
		id: string | number;
		confidence?: number;
		areaScore?: number;
		depthScore?: number;
	};

	let tableData = $state<DetectionRow[]>([]); // Will be filled with pothole data
	let roverPosition = $state({ x: 50, y: 40 }); // Percentage position on map
	let roverGpsPosition = $state({ lat: 45.419510, lng: -75.678772 }); // GPS coordinates (Ottawa default)
	let connectionStatus = $state('Disconnected');
	
	// Leaflet map variables
	let mapContainer: HTMLElement;
	let map: any;
	let L: any;
	let roverMarker: any = null;

	// Remove direct lidar websocket variables, replace with controller
	let lidarController: LidarMiniController | null = null;
	let lidarCanvasEl: HTMLCanvasElement | null = null;
	let imuUpdateInterval: ReturnType<typeof setInterval> | null = null;

	// ROS2 Command Center client for sensor data and video
	let commandCenterClient = $state<ROS2CommandCentreClient | null>(null);
	let isWebRTCReady = $state(false);
	let webRTCStatusMessage = $state('Connecting to rover...');
	let cleanupWebRTCListener: (() => void) | null = null;

	function updateWebRTCStatus(status: WebRTCStatus) {
		const activeElementId = `roverVideo${currentCamera}`;
		const matchesCurrentCamera = status.videoElementId === activeElementId;
		const hasStreamForActiveCamera = status.hasRemoteStream && matchesCurrentCamera;

		isWebRTCReady = hasStreamForActiveCamera;
		webRTCStatusMessage = status.isConnected
			? status.hasRemoteStream
				? (hasStreamForActiveCamera ? 'Camera feed connected' : 'Switching camera...')
				: 'Connecting to camera...'
			: 'Connecting to rover...';
	}

	function switchCamera(cameraNum: number) {
		currentCamera = cameraNum;
		if (commandCenterClient) {
			isWebRTCReady = false;
			webRTCStatusMessage = 'Switching camera...';
			commandCenterClient.setVideoElement(`roverVideo${cameraNum}`);
		}
	}

	// Convert Fahrenheit to Celsius
	function fahrenheitToCelsius(fahrenheit: number): number {
		return (fahrenheit - 32) * 5 / 9;
	}

	onMount(async () => {
		// Import Leaflet CSS
		if (browser) {
			await import('leaflet/dist/leaflet.css');
		}

		// Check for launch success notification
		if (typeof window !== 'undefined' && roverId) {
			const notificationKey = `rover_launch_success_${roverId}`;
			const storedNotification = sessionStorage.getItem(notificationKey);

			if (storedNotification) {
				try {
					const notificationData = JSON.parse(storedNotification);
					// Show notification if it's recent (within last 5 minutes)
					const isRecent = Date.now() - notificationData.timestamp < 5 * 60 * 1000;

					if (isRecent) {
						notification = {
							message: notificationData.message,
							waypointCount: notificationData.waypointCount,
							show: true
						};

						// Auto-hide notification after 10 seconds
						setTimeout(() => {
							if (notification) {
								notification.show = false;
							}
						}, 10000);
					}

					// Clear the notification from storage regardless
					sessionStorage.removeItem(notificationKey);
				} catch (error) {
					console.error('Failed to parse launch notification:', error);
				}
			}
		}

		// Initialize Leaflet map
		if (browser) {
			// A short delay can help ensure the container is rendered and sized
			setTimeout(initializeMap, 50);
		}
		// Create lidar controller and connect to ROS2 Command Center for data
		if (browser) {
			setTimeout(() => {
				// Create lidar visualization controller
				lidarController = createMiniLidar({ canvas: 'lidarMiniCanvas' });
				
				// Get command center client for this rover
				commandCenterClient = commandCenterManager.getClient(roverId);
				cleanupWebRTCListener?.();
				cleanupWebRTCListener = commandCenterClient.onWebRTCStatusChange(updateWebRTCStatus);
				
				const setupCommandCenterClient = () => {
					if (!commandCenterClient) return;

					commandCenterClient.setVideoElement(`roverVideo${currentCamera}`);
					commandCenterClient.onLidarData((lidarData) => {
						if (lidarController) {
							lidarController.updateData(lidarData);
						}
					});
					commandCenterClient.onStateChange((status) => {
						connectionStatus = status.isConnected ? 'Connected' : 'Disconnected';
						sensorData.isConnected = status.isConnected;
					});

					if (imuUpdateInterval) {
						clearInterval(imuUpdateInterval);
					}
					imuUpdateInterval = setInterval(() => {
						const imuRaw = commandCenterClient?.imuRawData;
						if (imuRaw) {
							sensorData.roll = imuRaw.roll;
							sensorData.pitch = imuRaw.pitch;
							sensorData.yaw = imuRaw.yaw;
							sensorData.temperature = imuRaw.temperature;
							sensorData.batteryVoltage = imuRaw.voltage;
						}
					}, 1000);

					const status = commandCenterClient.status;
					connectionStatus = status.isConnected ? 'Connected' : 'Disconnected';
					sensorData.isConnected = status.isConnected;

					const imuRaw = commandCenterClient.imuRawData;
					if (imuRaw) {
						sensorData.roll = imuRaw.roll;
						sensorData.pitch = imuRaw.pitch;
						sensorData.yaw = imuRaw.yaw;
						sensorData.temperature = imuRaw.temperature;
						sensorData.batteryVoltage = imuRaw.voltage;
					}
				};

				const ensureConnection = commandCenterClient.isConnected
					? Promise.resolve()
					: commandCenterClient.connect();

				ensureConnection
					.then(() => {
						setupCommandCenterClient();
					})
					.catch((err) => {
						console.error('Failed to connect to ROS2 Command Center:', err);
						connectionStatus = 'Connection Failed';
					});
			}, 80);
		}

		// Fetch detection data
		try {
			const res = await fetch('/api/detections');
			if (res.ok) {
				tableData = await res.json();
			} else {
				console.error('Failed to fetch detection data:', res.statusText);
			}
		} catch (err) {
			console.error('Error fetching detection data:', err);
		}

	});

	onDestroy(() => {
		lidarController = null;
		if (cleanupWebRTCListener) {
			cleanupWebRTCListener();
			cleanupWebRTCListener = null;
		}
	if (imuUpdateInterval) {
		clearInterval(imuUpdateInterval);
		imuUpdateInterval = null;
	}
		isWebRTCReady = false;
		webRTCStatusMessage = 'Connecting to rover...';
		
	if (commandCenterClient) {
		commandCenterClient.setVideoElement(null);
		commandCenterClient.onLidarData(null);
		commandCenterClient.onStateChange(null);
		commandCenterClient = null;
	}
	});

	async function initializeMap() {
		try {
			// Dynamically import Leaflet
			L = await import('leaflet');

			// Initialize the map
			map = L.map(mapContainer).setView([roverGpsPosition.lat, roverGpsPosition.lng], 15);

			// Add tile layer
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '© OpenStreetMap contributors'
			}).addTo(map);

			// Replace rover marker with pulsing current-location style icon
			const roverIcon = L.divIcon({
				html: `<div class="current-location-marker"><div class="pulse"></div><div class="dot"></div></div>`,
				className: '',
				iconSize: [30, 30],
				iconAnchor: [15, 15]
			});

			roverMarker = L.marker([roverGpsPosition.lat, roverGpsPosition.lng], { icon: roverIcon })
				.addTo(map)
				.bindPopup('Rover Position');

			// Invalidate map size after a short delay to ensure container is sized
			setTimeout(() => {
				map.invalidateSize();
			}, 100);
		} catch (error) {
			console.error('Error initializing map:', error);
		}
	}

	function dismissNotification() {
		if (notification) {
			notification.show = false;
		}
	}

	async function emergencyStop() {
		if (!commandCenterClient) {
			console.error('Command Center client not available');
			return;
		}

		try {
			console.log('Emergency stop triggered');
			
			// Send stop command first
			await commandCenterClient.stopRover();
			console.log('Emergency stop command sent successfully');
			
			// Show initial notification
			// notification = {
			// 	message: 'Emergency stop activated - Shutting down nodes...',
			// 	waypointCount: 0,
			// 	show: true
			// };
			
			// Monitor node status to confirm all nodes are offline
			let checkCount = 0;
			const maxChecks = 20; // 20 seconds max wait
			const checkInterval = setInterval(() => {
				checkCount++;
				const nodeStatus = commandCenterClient?.nodeStatus;
				
				if (nodeStatus) {
					// Check if all nodes are offline
					const allOffline = Object.values(nodeStatus.nodes).every(
						status => status === 'offline' || status === undefined
					);
					
					if (allOffline) {
						clearInterval(checkInterval);
						
						// Disconnect from ROS2
						commandCenterClient?.disconnect();
						
						// Show success notification
						notification = {
							message: 'Emergency Stop Completed Successfully',
							waypointCount: 0,
							show: true
						};
						
						// Auto-hide notification after 5 seconds
						setTimeout(() => {
							if (notification) {
								notification.show = false;
							}
						}, 5000);
						
						console.log('Emergency stop completed - all nodes offline');
					}
				}
				
				// Timeout after maxChecks
				if (checkCount >= maxChecks) {
					clearInterval(checkInterval);
					
					// Force disconnect even if nodes didn't report offline
					commandCenterClient?.disconnect();
					
					notification = {
						message: 'Emergency stop completed (timeout)',
						waypointCount: 0,
						show: true
					};
					
					setTimeout(() => {
						if (notification) {
							notification.show = false;
						}
					}, 5000);
					
					console.warn('Emergency stop timeout - forcing disconnect');
				}
			}, 1000); // Check every second
			
		} catch (error) {
			console.error('Failed to send emergency stop command:', error);
		}
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
	<!-- Launch Success Notification -->
	{#if notification?.show}
		<div class="notification-banner">
			<div class="notification-content">
				<div class="notification-icon">
					<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						></path>
					</svg>
				</div>
				<div class="notification-text">
					<h3 class="notification-title">{notification.message.includes('Emergency') ? 'Emergency Stop' : 'Launch Successful'}</h3>
					<p class="notification-message">{notification.message}</p>
				</div>
				<button
					class="notification-close"
					onclick={dismissNotification}
					aria-label="Dismiss notification"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						></path>
					</svg>
				</button>
			</div>
		</div>
	{/if}

	<!-- Main Dashboard Grid -->
	<div class="mx-4 max-w-none space-y-6">
		<!-- Top Row - Camera and Map -->
		<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
			<!-- Live Camera Section -->
			<div class="bg-white rounded-2xl shadow-lg border border-blue-100">
				<div class="p-6">
					<h2 class="text-xl font-bold text-blue-900 mb-4">Live Camera</h2>

					<!-- Camera Feed Display -->
					<div class="mb-4 w-full max-w-2xl mx-auto" style="aspect-ratio: 820/616;">
						<div class="w-full h-full overflow-hidden rounded-lg bg-black border border-blue-200 relative">
							<!-- Video elements for both cameras -->
							<video
								id="roverVideo1"
								autoplay
								playsinline
								muted
								width="820"
								height="616"
								class="absolute inset-0 w-full h-full object-contain {currentCamera === 1 ? 'block' : 'hidden'}"
							>
								Your browser does not support the video tag.
							</video>
							<video
								id="roverVideo2"
								autoplay
								playsinline
								muted
								width="1280"
								height="720"
								class="absolute inset-0 w-full h-full object-contain {currentCamera === 2 ? 'block' : 'hidden'}"
							>
								Your browser does not support the video tag.
							</video>
						
							<!-- Fallback when no stream is available -->
							{#if !isWebRTCReady}
								<div class="absolute inset-0 flex items-center justify-center text-center text-blue-600 bg-blue-50">
									<div>
										<img
											src="/video_cam.png"
											alt="Camera connection placeholder"
											class="mx-auto mb-2 h-16 w-16 object-contain"
											loading="lazy"
										/>
										<p class="font-medium">Camera {currentCamera} Feed</p>
										<p class="text-sm text-blue-500">{webRTCStatusMessage}</p>
									</div>
								</div>
							{/if}
						</div>
					</div>

					<!-- Camera Switch Buttons -->
					<div class="flex justify-center gap-2">
						<button
							class="px-4 py-2 rounded-lg font-medium transition-colors {currentCamera === 1 ? 'bg-blue-500 text-white' : 'border border-blue-300 text-blue-600 hover:bg-blue-50'}"
							onclick={() => switchCamera(1)}
						>
							Camera 1
						</button>
						<button
							class="px-4 py-2 rounded-lg font-medium transition-colors {currentCamera === 2 ? 'bg-blue-500 text-white' : 'border border-blue-300 text-blue-600 hover:bg-blue-50'}"
							onclick={() => switchCamera(2)}
						>
							Camera 2
						</button>
					</div>
				</div>
			</div>

			<!-- Map Section -->
			<div class="bg-white rounded-2xl shadow-lg border border-blue-100">
				<div class="p-6">
					<h2 class="text-xl font-bold text-blue-900 mb-4">Map</h2>

					<!-- Leaflet Map Display -->
					<div class="mb-4 w-full max-w-2xl mx-auto" style="aspect-ratio: 820/616;">
						<div class="relative w-full h-full overflow-hidden rounded-lg border border-blue-200">
							<div bind:this={mapContainer} class="z-0 h-full w-full"></div>
						</div>
					</div>
					
					<!-- Spacer to match camera buttons height -->
					<div class="h-10"></div>
				</div>
			</div>
		</div>

		<!-- Bottom Row - Live Data, Data Table, Navigation -->
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
			<!-- Live Metrics widened -->
			<div class="bg-white rounded-2xl shadow-lg border border-blue-100 lg:col-span-4">
				<div class="p-6">
					<h2 class="text-xl font-bold text-blue-900 mb-4">Live Metrics</h2>
					<div class="mb-4 grid grid-cols-2 gap-2">
						<div class="bg-blue-50 p-3 rounded-lg border border-blue-200 col-span-2">
							<div class="text-sm text-blue-600 font-medium">Roll/Pitch/Yaw</div>
							<div class="text-sm font-bold text-blue-900">
								{sensorData.isConnected ? 
									`${sensorData.roll.toFixed(1)}° / ${sensorData.pitch.toFixed(1)}° / ${sensorData.yaw.toFixed(1)}°` : 
									'-- / -- / --'
								}
							</div>
						</div>
						<div class="bg-blue-50 p-3 rounded-lg border border-blue-200">
							<div class="text-sm text-blue-600 font-medium">TEMP</div>
							<div class="text-lg font-bold text-blue-900">
								{sensorData.isConnected ? `${fahrenheitToCelsius(sensorData.temperature).toFixed(1)}°C` : 'N/A'}
							</div>
						</div>
						<div class="bg-blue-50 p-3 rounded-lg border border-blue-200">
							<div class="text-sm text-blue-600 font-medium">Battery</div>
							<div class="text-lg font-bold text-blue-900">
								{sensorData.isConnected ? `${sensorData.batteryVoltage.toFixed(1)}V` : 'N/A'}
							</div>
						</div>
						<!-- <div class="bg-blue-50 p-3 rounded-lg border border-blue-200 col-span-2">
							<div class="text-sm text-blue-600 font-medium">Movement</div>
							<div class="text-sm font-bold text-blue-900">
								{sensorData.isConnected ? 
									`L: ${sensorData.linearVelocity.toFixed(2)}m/s A: ${sensorData.angularVelocity.toFixed(2)}rad/s` :
									'L: N/A  A: N/A'
								}
							</div>
						</div> -->
						<div class="bg-blue-50 p-3 rounded-lg border border-blue-200 col-span-2">
							<div class="text-sm text-blue-600 font-medium">ROS Status</div>
							<div class="text-sm font-bold {sensorData.isConnected ? 'text-green-600' : 'text-red-600'}">
								{connectionStatus}
							</div>
						</div>
					</div>

					<!-- Lidar Visualization -->
					<div class="flex justify-center">
						<canvas
							id="lidarMiniCanvas"
							width="300"
							height="300"
							class="h-80 w-80 border border-blue-200 rounded-lg"
							bind:this={lidarCanvasEl}
						></canvas>
					</div>
				</div>
			</div>

			<!-- Data Table narrowed -->
			<div class="bg-white rounded-2xl shadow-lg border border-blue-100 lg:col-span-6">
				<div class="p-6">
					<h2 class="text-xl font-bold text-blue-900 mb-4">Data Table</h2>
					<div class="overflow-x-auto">
						<table class="w-full">
							<thead>
								<tr class="border-b border-blue-200">
									<th class="text-left text-blue-600 font-medium py-2">ID</th>
									<th class="text-left text-blue-600 font-medium py-2">Confidence</th>
									<th class="text-left text-blue-600 font-medium py-2">Area Score</th>
									<th class="text-left text-blue-600 font-medium py-2">Depth Score</th>
								</tr>
							</thead>
							<tbody>
								{#each tableData as row}
									<tr class="border-b border-blue-100 hover:bg-blue-50 cursor-pointer" onclick={() => goto(`/detections/${row.id}?roverId=${roverId}`)}>
										<td class="py-2 text-blue-900">{row.id}</td>
										<td class="py-2 text-blue-900">{row.confidence != null ? row.confidence.toFixed(2) : 'N/A'}</td>
										<td class="py-2 text-blue-900">{row.areaScore != null ? row.areaScore.toFixed(2) : 'N/A'}</td>
										<td class="py-2 text-blue-900">{row.depthScore != null ? row.depthScore.toFixed(2) : 'N/A'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			<!-- Navigation widened -->
			<div class="bg-white rounded-2xl shadow-lg border border-blue-100 flex lg:col-span-2">
				<div class="p-4 flex flex-col justify-center gap-4 w-full">
					<a href="/manual-ctrl/{roverId}" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg font-medium transition-colors text-center">Manual Control</a>
					<button class="bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-lg font-medium transition-colors" onclick={emergencyStop}>E-Stop</button>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.notification-banner {
		position: fixed;
		top: 20px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1000;
		max-width: 600px;
		width: 90%;
		animation: slideDown 0.3s ease-out;
	}

	.notification-content {
		background: linear-gradient(135deg, #3b82f6, #2563eb);
		color: white;
		padding: 16px 20px;
		border-radius: 12px;
		box-shadow: 0 10px 25px rgba(59, 130, 246, 0.3);
		display: flex;
		align-items: flex-start;
		gap: 12px;
		position: relative;
	}

	.notification-icon {
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		margin-top: 2px;
	}

	.notification-text {
		flex: 1;
		text-align: left;
	}

	.notification-title {
		font-weight: 600;
		font-size: 1.1rem;
		margin: 0 0 4px 0;
	}

	.notification-message {
		font-size: 0.9rem;
		margin: 0 0 4px 0;
		opacity: 0.95;
	}

	.notification-details {
		font-size: 0.8rem;
		margin: 0;
		opacity: 0.8;
		font-style: italic;
	}

	.notification-close {
		flex-shrink: 0;
		background: none;
		border: none;
		color: white;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		transition: background-color 0.2s ease;
	}

	.notification-close:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	@keyframes slideDown {
		from {
			transform: translateX(-50%) translateY(-100%);
			opacity: 0;
		}
		to {
			transform: translateX(-50%) translateY(0);
			opacity: 1;
		}
	}

	:global(.current-location-marker) {
		position: relative;
		width: 30px;
		height: 30px;
		pointer-events: none;
	}
	:global(.current-location-marker .dot) {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 14px;
		height: 14px;
		transform: translate(-50%, -50%);
		background: #2563eb;
		border: 3px solid #ffffff;
		border-radius: 50%;
		box-shadow: 0 0 6px rgba(37, 99, 235, 0.6);
	}
	:global(.current-location-marker .pulse) {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 14px;
		height: 14px;
		transform: translate(-50%, -50%);
		background: rgba(37, 99, 235, 0.35);
		border-radius: 50%;
		animation: pulse-ring 2s ease-out infinite;
	}
	@keyframes pulse-ring {
		0% {
			transform: translate(-50%, -50%) scale(0.6);
			opacity: 0.9;
		}
		70% {
			transform: translate(-50%, -50%) scale(2.2);
			opacity: 0;
		}
		100% {
			transform: translate(-50%, -50%) scale(2.2);
			opacity: 0;
		}
	}
</style>
