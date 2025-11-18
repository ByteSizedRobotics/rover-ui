<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import type { PageServerData } from './$types';
	import { browser } from '$app/environment';
	import { createMiniLidar, LidarMiniController } from '../lidarController';
	import {
		commandCenterManager,
		type ROS2CommandCentreClient,
		type CameraStreamStatus
	} from '$lib/ros2CommandCentre';
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
	const pathId: string = params.pathId ?? '';

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
	let roverGpsPosition = $state({ lat: 45.41951, lng: -75.678772 }); // GPS coordinates (Ottawa default)
	let connectionStatus = $state('Connecting...');
	const DETECTION_POLL_INTERVAL_MS = 5000;
	let detectionPoller: ReturnType<typeof setInterval> | null = null;

	// Leaflet map variables
	let mapContainer: HTMLElement;
	let map: any;
	let L: any;
	let roverMarker: any = null;

	// Remove direct lidar websocket variables, replace with controller
	let lidarController: LidarMiniController | null = null;
	let lidarCanvasEl: HTMLCanvasElement | null = null;
	let imuUpdateInterval: ReturnType<typeof setInterval> | null = null;
	let gpsUpdateInterval: ReturnType<typeof setInterval> | null = null;

	// ROS2 Command Center client for sensor data and video
	let commandCenterClient = $state<ROS2CommandCentreClient | null>(null);
	let isCSICameraReady = $state(false);
	let isUSBCameraReady = $state(false);
	let isCSI2CameraReady = $state(false);
	let csiStatusMessage = $state('Connecting to Side camera 1...');
	let usbStatusMessage = $state('Connecting to Front camera...');
	let csi2StatusMessage = $state('Connecting to Side camera 2...');
	let cleanupWebRTCListener: (() => void) | null = null;
	let streamMonitorInterval: ReturnType<typeof setInterval> | null = null;
	let lastFrameCheck = $state({ csi: 0, usb: 0, csi2: 0 });

	function updateWebRTCStatus(status: CameraStreamStatus) {
		// Update CSI camera (Camera 1) status
		isCSICameraReady = status.csi.isConnected && status.csi.hasRemoteStream;
		csiStatusMessage = status.csi.isConnected
			? status.csi.hasRemoteStream
				? 'CSI camera connected'
				: 'Connecting to CSI camera...'
			: 'CSI camera disconnected';

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

	function monitorVideoStreams() {
		// Check if video elements are actually playing
		const video1 = document.getElementById('roverVideo1') as HTMLVideoElement;
		const video2 = document.getElementById('roverVideo2') as HTMLVideoElement;
		const video3 = document.getElementById('roverVideo3') as HTMLVideoElement;

		const checkVideo = (video: HTMLVideoElement | null, cameraType: 'csi' | 'usb' | 'csi2', cameraName: string) => {
			if (!video) return;
			
			const currentTime = video.currentTime;
			const lastTime = lastFrameCheck[cameraType];
			
			// If video is supposedly ready but currentTime hasn't changed in 5 seconds, it's frozen
			if (currentTime === lastTime && currentTime > 0) {
				const isReady = cameraType === 'csi' ? isCSICameraReady : 
				                cameraType === 'usb' ? isUSBCameraReady : isCSI2CameraReady;
				
				if (isReady) {
					console.warn(`${cameraName} stream appears frozen. Attempting restart...`);
					
					// Try to restart the stream by reconnecting WebRTC for this camera
					if (commandCenterClient) {
						commandCenterClient.reconnectCamera(cameraType);
						console.log(`Reconnecting ${cameraName}...`);
					}
				}
			}
			
			lastFrameCheck[cameraType] = currentTime;
		};

		checkVideo(video1, 'csi', 'CSI Camera 1');
		checkVideo(video2, 'usb', 'USB Camera');
		checkVideo(video3, 'csi2', 'CSI Camera 2');
	}

	function switchCamera(cameraNum: number) {
		currentCamera = cameraNum;
		// No need to do anything else - both cameras are already connected
		// The UI will automatically show/hide the correct video element
	}

	// Convert Fahrenheit to Celsius
	function fahrenheitToCelsius(fahrenheit: number): number {
		return ((fahrenheit - 32) * 5) / 9;
	}

	// Calculate battery percentage from voltage
	function calculateBatteryPercentage(voltage: number): number {
		let level = (voltage - 9.0) / (12.6 - 9.0) * 100.0;
		level = Math.max(0.0, Math.min(100.0, level));
		return level;
	}

	async function loadDetections() {
		try {
			// Filter detections by pathId - we need to get images for this path first
			// Then get detections for those images
			const imagesRes = await fetch(`/api/images?pathId=${pathId}`, { cache: 'no-store' });
			if (!imagesRes.ok) {
				console.error('Failed to fetch images for path:', imagesRes.statusText);
				return;
			}
			const images = await imagesRes.json();
			const imageIds = images.map((img: any) => img.id);
			
			if (imageIds.length === 0) {
				console.log('No images found for this path');
				tableData = [];
				return;
			}

			// Fetch all detections and filter by imageIds
			const res = await fetch('/api/detections', { cache: 'no-store' });
			if (!res.ok) {
				console.error('Failed to fetch detection data:', res.statusText);
				return;
			}
			const allDetections = await res.json();
			
			// Filter to only detections from images in this path
			tableData = allDetections.filter((detection: any) => 
				imageIds.includes(detection.imageId)
			);
		} catch (err) {
			console.error('Error fetching detection data:', err);
		}
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
		
		// Set the path ID in command center manager BEFORE connecting
		if (pathId) {
			commandCenterManager.setLatestPathId(roverId, Number(pathId));
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

					// Set up all three camera video elements
					commandCenterClient.setVideoElement('roverVideo1', 'csi');
					commandCenterClient.setVideoElement('roverVideo2', 'usb');
					commandCenterClient.setVideoElement('roverVideo3', 'csi2');

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

			// Poll GPS data and update map every 3 seconds
			if (gpsUpdateInterval) {
				clearInterval(gpsUpdateInterval);
			}
			gpsUpdateInterval = setInterval(() => {
				const gps = commandCenterClient?.gpsData;
				
				// Validate GPS data before updating
				if (gps && gps.latitude && gps.longitude && 
				    !isNaN(gps.latitude) && !isNaN(gps.longitude) &&
				    Math.abs(gps.latitude) <= 90 && Math.abs(gps.longitude) <= 180) {
					
					// Only update if map and marker are ready
					if (roverMarker && map && L) {
						// Update stored position
						roverGpsPosition = { lat: gps.latitude, lng: gps.longitude };
						
						// Smoothly update marker position
						roverMarker.setLatLng([gps.latitude, gps.longitude]);
						
						// Only pan the map if the rover has moved significantly (> 0.0001 degrees ~11m)
						const center = map.getCenter();
						const distance = Math.sqrt(
							Math.pow(center.lat - gps.latitude, 2) + 
							Math.pow(center.lng - gps.longitude, 2)
						);
						
						if (distance > 0.0001) {
							// Use panTo for smooth movement instead of setView
							map.panTo([gps.latitude, gps.longitude], {
								animate: true,
								duration: 0.5,
								noMoveStart: true
							});
						}
					} else {
						console.warn('Map or marker not ready:', { roverMarker: !!roverMarker, map: !!map, L: !!L });
					}
				}
				// If GPS data is invalid or missing, keep using previous position (no update)
			}, 3000);					const status = commandCenterClient.status;
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
					: commandCenterClient.connect({ enableCSICamera: true, enableUSBCamera: true, enableCSI2Camera: true });

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

		// Start monitoring video streams for freezes
		streamMonitorInterval = setInterval(monitorVideoStreams, 5000); // Check every 5 seconds

		await loadDetections();
		detectionPoller = setInterval(loadDetections, DETECTION_POLL_INTERVAL_MS);
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
		if (gpsUpdateInterval) {
			clearInterval(gpsUpdateInterval);
			gpsUpdateInterval = null;
		}
		isCSICameraReady = false;
		isUSBCameraReady = false;
		isCSI2CameraReady = false;
		csiStatusMessage = 'Connecting to CSI camera...';
		usbStatusMessage = 'Connecting to USB camera...';
		csi2StatusMessage = 'Connecting to CSI camera 2...';

		if (commandCenterClient) {
			// Clear all three camera video elements
			commandCenterClient.setVideoElement(null, 'csi');
			commandCenterClient.setVideoElement(null, 'usb');
			commandCenterClient.setVideoElement(null, 'csi2');
			commandCenterClient.onLidarData(null);
			commandCenterClient.onStateChange(null);
			commandCenterClient = null;
		}
		if (detectionPoller) {
			clearInterval(detectionPoller);
			detectionPoller = null;
		}
		if (streamMonitorInterval) {
			clearInterval(streamMonitorInterval);
			streamMonitorInterval = null;
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
				iconSize: [40, 40],
				iconAnchor: [20, 20]
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
						(status) => status === 'offline' || status === undefined
					);

					if (allOffline) {
						clearInterval(checkInterval);

						// Mark as emergency stopped to prevent reconnection
						commandCenterClient?.markEmergencyStopped();

						// Disconnect from ROS2
						commandCenterClient?.disconnect();

						// Update connection status
						connectionStatus = 'Disconnected';
						sensorData.isConnected = false;

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

					// Mark as emergency stopped to prevent reconnection
					commandCenterClient?.markEmergencyStopped();

					// Force disconnect even if nodes didn't report offline
					commandCenterClient?.disconnect();

					// Update connection status
					connectionStatus = 'Disconnected';
					sensorData.isConnected = false;

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
	<!-- Path Info Header -->
	{#if data.pathTimestamp}
		<div class="mx-4 mb-4 rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-2xl font-bold text-blue-900">
						{data.name || `Rover ${roverId}`} - Path #{pathId}
					</h1>
					<p class="text-sm text-blue-600">
						Path started: {new Date(data.pathTimestamp).toLocaleString()}
					</p>
				</div>
			</div>
		</div>
	{/if}

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
					<h3 class="notification-title">
						{notification.message.includes('Emergency') ? 'Emergency Stop' : 'Launch Successful'}
					</h3>
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
			<div class="rounded-2xl border border-blue-100 bg-white shadow-lg">
				<div class="p-6">
					<h2 class="mb-4 text-xl font-bold text-blue-900">Live Camera</h2>

					<!-- Camera Feed Display -->
					<div class="mx-auto mb-4 w-full max-w-2xl" style="aspect-ratio: 820/616;">
						<div
							class="relative h-full w-full overflow-hidden rounded-lg border border-blue-200 bg-black"
						>
						<!-- Video elements for all three cameras -->
						<video
							id="roverVideo1"
							autoplay
							playsinline
							muted
							width="1280"
							height="720"
							class="absolute inset-0 h-full w-full object-contain {currentCamera === 1
								? 'block'
								: 'hidden'}"
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
							class="absolute inset-0 h-full w-full object-contain {currentCamera === 2
								? 'block'
								: 'hidden'}"
						>
							Your browser does not support the video tag.
						</video>
						<video
							id="roverVideo3"
							autoplay
							playsinline
							muted
							width="1280"
							height="720"
							class="absolute inset-0 h-full w-full object-contain {currentCamera === 3
								? 'block'
								: 'hidden'}"
						>
							Your browser does not support the video tag.
						</video>							<!-- Fallback when no stream is available for current camera -->
							{#if (currentCamera === 1 && !isCSICameraReady) || (currentCamera === 2 && !isUSBCameraReady) || (currentCamera === 3 && !isCSI2CameraReady)}
								<div
									class="absolute inset-0 flex items-center justify-center bg-blue-50 text-center text-blue-600"
								>
									<div>
										<img
											src="/video_cam.png"
											alt="Camera connection placeholder"
											class="mx-auto mb-2 h-16 w-16 object-contain"
											loading="lazy"
										/>
										<p class="font-medium">
											{currentCamera === 1 ? 'CSI Camera 1' : currentCamera === 2 ? 'USB Camera' : 'CSI Camera 2'} Feed
										</p>
										<p class="text-sm text-blue-500">
											{currentCamera === 1 ? csiStatusMessage : currentCamera === 2 ? usbStatusMessage : csi2StatusMessage}
										</p>
									</div>
								</div>
							{/if}
						</div>
					</div>

					<!-- Camera Switch Buttons -->
					<div class="flex justify-center gap-2">
						<button
							class="relative rounded-lg px-4 py-2 font-medium transition-colors {currentCamera ===
							1
								? 'bg-blue-500 text-white'
								: 'border border-blue-300 text-blue-600 hover:bg-blue-50'}"
							onclick={() => switchCamera(1)}
						>
							CSI Camera 1
							{#if isCSICameraReady}
								<span class="absolute right-1 top-1 h-2 w-2 rounded-full bg-green-400"></span>
							{/if}
						</button>
						<button
							class="relative rounded-lg px-4 py-2 font-medium transition-colors {currentCamera ===
							2
								? 'bg-blue-500 text-white'
								: 'border border-blue-300 text-blue-600 hover:bg-blue-50'}"
							onclick={() => switchCamera(2)}
						>
							USB Camera
							{#if isUSBCameraReady}
								<span class="absolute right-1 top-1 h-2 w-2 rounded-full bg-green-400"></span>
							{/if}
						</button>
						<button
							class="relative rounded-lg px-4 py-2 font-medium transition-colors {currentCamera ===
							3
								? 'bg-blue-500 text-white'
								: 'border border-blue-300 text-blue-600 hover:bg-blue-50'}"
							onclick={() => switchCamera(3)}
						>
							CSI Camera 2
							{#if isCSI2CameraReady}
								<span class="absolute right-1 top-1 h-2 w-2 rounded-full bg-green-400"></span>
							{/if}
						</button>
					</div>
				</div>
			</div>

			<!-- Map Section -->
			<div class="rounded-2xl border border-blue-100 bg-white shadow-lg">
				<div class="p-6">
					<h2 class="mb-4 text-xl font-bold text-blue-900">Map</h2>

					<!-- Leaflet Map Display -->
					<div class="mx-auto mb-4 w-full max-w-2xl" style="aspect-ratio: 820/616;">
						<div class="relative h-full w-full overflow-hidden rounded-lg border border-blue-200">
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
			<div class="rounded-2xl border border-blue-100 bg-white shadow-lg lg:col-span-4">
				<div class="p-6">
					<h2 class="mb-4 text-xl font-bold text-blue-900">Live Metrics</h2>
					<div class="mb-4 grid grid-cols-2 gap-2">
						<div class="col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
							<div class="text-sm font-medium text-blue-600">Roll/Pitch/Yaw</div>
							<div class="text-sm font-bold text-blue-900">
								{sensorData.isConnected
									? `${sensorData.roll.toFixed(1)}° / ${sensorData.pitch.toFixed(1)}° / ${sensorData.yaw.toFixed(1)}°`
									: '-- / -- / --'}
							</div>
						</div>
						<div class="rounded-lg border border-blue-200 bg-blue-50 p-3">
							<div class="text-sm font-medium text-blue-600">TEMP</div>
							<div class="text-lg font-bold text-blue-900">
								{sensorData.isConnected
									? `${fahrenheitToCelsius(sensorData.temperature).toFixed(1)}°C`
									: 'N/A'}
							</div>
						</div>
						<div class="rounded-lg border border-blue-200 bg-blue-50 p-3">
							<div class="text-sm font-medium text-blue-600">Battery</div>
							<div class="text-lg font-bold text-blue-900">
								{sensorData.isConnected 
									? `${sensorData.batteryVoltage.toFixed(1)}V (${calculateBatteryPercentage(sensorData.batteryVoltage).toFixed(0)}%)` 
									: 'N/A'}
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
						<div class="col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
							<div class="text-sm font-medium text-blue-600">ROS Status</div>
							<div
								class="text-sm font-bold {sensorData.isConnected
									? 'text-green-600'
									: 'text-red-600'}"
							>
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
							class="h-80 w-80 rounded-lg border border-blue-200"
							bind:this={lidarCanvasEl}
						></canvas>
					</div>
				</div>
			</div>

			<!-- Data Table narrowed -->
			<div class="rounded-2xl border border-blue-100 bg-white shadow-lg lg:col-span-6">
				<div class="p-6">
					<h2 class="mb-4 text-xl font-bold text-blue-900">Data Table</h2>
					<div class="overflow-x-auto">
						<table class="w-full">
							<thead>
								<tr class="border-b border-blue-200">
									<th class="py-2 text-left font-medium text-blue-600">ID</th>
									<th class="py-2 text-left font-medium text-blue-600">Confidence</th>
									<th class="py-2 text-left font-medium text-blue-600">Area Score</th>
									<th class="py-2 text-left font-medium text-blue-600">Depth Score</th>
								</tr>
							</thead>
							<tbody>
								{#each tableData as row}
									<tr
										class="cursor-pointer border-b border-blue-100 hover:bg-blue-50"
										onclick={() => goto(`/detections/${row.id}?roverId=${roverId}&pathId=${pathId}`)}
									>
										<td class="py-2 text-blue-900">{row.id}</td>
										<td class="py-2 text-blue-900"
											>{row.confidence != null ? row.confidence.toFixed(2) : 'N/A'}</td
										>
										<td class="py-2 text-blue-900"
											>{row.areaScore != null ? row.areaScore.toFixed(2) : 'N/A'}</td
										>
										<td class="py-2 text-blue-900"
											>{row.depthScore != null ? row.depthScore.toFixed(2) : 'N/A'}</td
										>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			<!-- Navigation widened -->
			<div class="flex rounded-2xl border border-blue-100 bg-white shadow-lg lg:col-span-2">
				<div class="flex w-full flex-col justify-center gap-4 p-4">
					<a
						href="/manual-ctrl/{roverId}"
						class="rounded-lg bg-blue-500 px-4 py-3 text-center font-medium text-white transition-colors hover:bg-blue-600"
						>Manual Control</a
					>
					<button
						class="rounded-lg bg-red-500 px-4 py-3 font-medium text-white transition-colors hover:bg-red-600"
						onclick={emergencyStop}>E-Stop</button
					>
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
