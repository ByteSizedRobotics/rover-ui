<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import type { PageServerData } from './$types';
	import { browser } from '$app/environment';
	import { createAndConnectMiniLidar, LidarMiniController } from './lidarController';
	import { commandCenterManager, type ROS2CommandCentreClient } from '$lib/ros2CommandCentre';
	import { getWebRTCWebSocketURL } from '$lib/ros2Config';

	let { data }: { data: PageServerData } = $props();

	// Notification state
	let notification = $state<{
		message: string;
		waypointCount: number;
		show: boolean;
	} | null>(null);

	const params = get(page).params;
	const roverId = params.id;

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
	let tableData = $state([
		{ id: 1, value: 10, status: 'A' },
		{ id: 2, value: 21, status: 'B' },
		{ id: 3, value: 15, status: 'C' }
	]);
	let roverPosition = $state({ x: 50, y: 40 }); // Percentage position on map
	let roverGpsPosition = $state({ lat: 45.4215, lng: -75.6972 }); // GPS coordinates (Ottawa default)
	let connectionStatus = $state('Disconnected');
	
	// Leaflet map variables
	let mapContainer: HTMLElement;
	let map: any;
	let L: any;
	let roverMarker: any = null;

	// Remove direct lidar websocket variables, replace with controller
	let lidarController: LidarMiniController | null = null;
	let lidarCanvasEl: HTMLCanvasElement | null = null;

	// ROS2 Command Center client for camera feed
	let commandCenterClient = $state<ROS2CommandCentreClient | null>(null); // retained for future sensor integration

	// Direct WebRTC (manual-control style) state
	let webrtcSocket: WebSocket | null = null;
	let peerConnection: RTCPeerConnection | null = null;
	let remoteStream: MediaStream | null = null;
	let webrtcConnected = $state(false);

	function bindStreamToCurrentCamera() {
		if (!remoteStream) return;
		const videoEl = document.getElementById(`roverVideo${currentCamera}`) as HTMLVideoElement | null;
		if (videoEl && videoEl.srcObject !== remoteStream) {
			videoEl.srcObject = remoteStream;
			videoEl.play().catch((e) => console.error('Video play error:', e));
		}
	}

	async function startWebRTC() {
		// Initialize RTCPeerConnection
		peerConnection = new RTCPeerConnection({
			iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }]
		});

		peerConnection.addTransceiver('video', { direction: 'recvonly' });

		peerConnection.ontrack = (event) => {
			remoteStream = event.streams[0];
			webrtcConnected = true;
			bindStreamToCurrentCamera();
		};

		peerConnection.onicecandidate = (event) => {
			if (event.candidate && webrtcSocket) {
				webrtcSocket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
			}
		};

		const offer = await peerConnection.createOffer();
		await peerConnection.setLocalDescription(offer);
		if (webrtcSocket) {
			webrtcSocket.send(JSON.stringify({ type: 'offer', sdp: offer.sdp }));
		}
	}

	function connectWebRTC() {
		try {
			const wsUrl = getWebRTCWebSocketURL();
			webrtcSocket = new WebSocket(wsUrl);
			webrtcSocket.onopen = () => {
				startWebRTC().catch((e) => console.error('Failed to start WebRTC:', e));
			};
			webrtcSocket.onerror = (e) => {
				console.error('WebRTC signaling error:', e);
			};
			webrtcSocket.onclose = () => {
				webrtcConnected = false;
			};
			webrtcSocket.onmessage = (event) => {
				try {
					const msg = JSON.parse(event.data);
					if (msg.type === 'answer' && peerConnection) {
						peerConnection.setRemoteDescription(new RTCSessionDescription(msg));
					} else if (msg.type === 'ice-candidate' && peerConnection) {
						peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
					}
				} catch (err) {
					console.error('Error parsing WebRTC message:', err);
				}
			};
		} catch (err) {
			console.error('Failed to open WebRTC socket:', err);
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
		// Create and connect lidar controller (no inline websocket logic remains)
		if (browser) {
			setTimeout(() => {
				lidarController = createAndConnectMiniLidar({ canvas: 'lidarMiniCanvas' });
			}, 80);
		}

		// Direct WebRTC setup for camera feed (manual-control style)
		if (browser) {
			setTimeout(connectWebRTC, 120);
		}

	});

	onDestroy(() => {
		lidarController?.disconnect();
		lidarController = null;
		
		// Clean up command center client if used (not needed for video feed now)
		if (commandCenterClient) {
			commandCenterClient.disconnect();
			commandCenterClient = null;
		}

		// Clean up WebRTC
		if (peerConnection) {
			peerConnection.close();
			peerConnection = null;
		}
		if (webrtcSocket) {
			webrtcSocket.close();
			webrtcSocket = null;
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

	function switchCamera(cameraNumber: number) {
		if (currentCamera === cameraNumber) return; // No change needed
		currentCamera = cameraNumber;
		// Re-bind remote stream (if already received) to new visible element
		bindStreamToCurrentCamera();
	}

	function emergencyStop() {
		// TODO: Implement emergency stop
		console.log('Emergency stop triggered');
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
					<h3 class="notification-title">🚀 Launch Successful!</h3>
					<p class="notification-message">{notification.message}</p>
					<p class="notification-details">
						The rover is now autonomously navigating to its destination.
					</p>
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
					<div class="mb-4 w-full max-w-2xl mx-auto" style="aspect-ratio: 16/9;">
						<div class="w-full h-full overflow-hidden rounded-lg bg-black border border-blue-200 relative">
							<!-- Video elements for both cameras -->
							<video
								id="roverVideo1"
								autoplay
								playsinline
								muted
								width="1280"
								height="720"
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
							{#if !webrtcConnected}
								<div class="absolute inset-0 flex items-center justify-center text-center text-blue-600 bg-blue-50">
									<div>
										<svg
											class="mx-auto mb-2 h-16 w-16"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 002 2z"
											></path>
										</svg>
										<p class="font-medium">Camera {currentCamera} Feed</p>
										<p class="text-sm text-blue-500">{webrtcSocket ? 'Connecting to camera...' : 'Connecting to rover...'}</p>
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
			<div class="bg-white rounded-2xl shadow-lg border border-blue-100 h-full">
				<div class="p-6 flex h-full flex-col">
					<h2 class="text-xl font-bold text-blue-900 mb-4">Map</h2>

					<!-- Leaflet Map Display -->
					<div class="relative mb-4 aspect-video flex-grow overflow-hidden rounded-lg border border-blue-200">
						<div bind:this={mapContainer} class="z-0 h-full w-full"></div>
					</div>
				</div>
			</div>
		</div>

		<!-- Bottom Row - Live Data, Data Table, Navigation -->
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
			<!-- Live Metrics widened -->
			<div class="bg-white rounded-2xl shadow-lg border border-blue-100 lg:col-span-4">
				<div class="p-6">
					<h2 class="text-xl font-bold text-blue-900 mb-4">Live Metrics</h2>
					<div class="mb-4 grid grid-cols-1 gap-2">
						<div class="bg-blue-50 p-3 rounded-lg border border-blue-200">
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
								{sensorData.isConnected ? `${sensorData.temperature.toFixed(1)}°C` : 'N/A'}
							</div>
						</div>
						<div class="bg-blue-50 p-3 rounded-lg border border-blue-200">
							<div class="text-sm text-blue-600 font-medium">Battery</div>
							<div class="text-lg font-bold text-blue-900">
								{sensorData.isConnected ? `${sensorData.batteryVoltage.toFixed(1)}V` : 'N/A'}
							</div>
						</div>
						<div class="bg-blue-50 p-3 rounded-lg border border-blue-200">
							<div class="text-sm text-blue-600 font-medium">Movement</div>
							<div class="text-sm font-bold text-blue-900">
								{sensorData.isConnected ? 
									`L: ${sensorData.linearVelocity.toFixed(2)}m/s A: ${sensorData.angularVelocity.toFixed(2)}rad/s` :
									'L: N/A  A: N/A'
								}
							</div>
						</div>
						<div class="bg-blue-50 p-3 rounded-lg border border-blue-200">
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
									<th class="text-left text-blue-600 font-medium py-2">Value</th>
									<th class="text-left text-blue-600 font-medium py-2">Status</th>
								</tr>
							</thead>
							<tbody>
								{#each tableData as row}
									<tr class="border-b border-blue-100 hover:bg-blue-50">
										<td class="py-2 text-blue-900">{row.id}</td>
										<td class="py-2 text-blue-900">{row.value}</td>
										<td class="py-2">
											<span class="px-2 py-1 rounded-full text-xs font-medium {
												row.status === 'A' ? 'bg-blue-100 text-blue-600' :
												row.status === 'B' ? 'bg-blue-200 text-blue-700' :
												'bg-blue-300 text-blue-800'
											}">{row.status}</span>
										</td>
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
