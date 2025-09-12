<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import type { PageServerData } from "./$types";
	import { browser } from '$app/environment';
	
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
		imu: -0.2,
		temperature: 35,
		battery: 85,
		lidarAngle: 45
	});
	let tableData = $state([
		{ id: 1, value: 10, status: 'A' },
		{ id: 2, value: 21, status: 'B' },
		{ id: 3, value: 15, status: 'C' }
	]);
	let roverPosition = $state({ x: 50, y: 40 }); // Percentage position on map
	let roverGpsPosition = $state({ lat: 45.5017, lng: -73.5673 }); // GPS coordinates (Montreal default)
	
	// Leaflet map variables
	let mapContainer: HTMLElement;
	let map: any;
	let L: any;

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

		// TODO: Subscribe to ROS topics for live data
		// Example subscriptions (implement based on your ROS bridge setup):
		// - /camera/image_raw for camera feeds
		// - /imu/data for IMU readings
		// - /temperature for temperature sensor
		// - /battery_state for battery level
		// - /scan for lidar data
		// - /amcl_pose for rover position
		// - /gps/fix for GPS coordinates
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
			
			// Add rover marker
			const roverIcon = L.divIcon({
				html: `<div style="background: #3b82f6; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
						 <svg style="width: 12px; height: 12px; color: white;" fill="currentColor" viewBox="0 0 24 24">
						   <path d="M12 2L2 7v10c0 5.55 3.84 10 9 11 1.9-.4 3.7-1.4 5.2-2.8 1.5-1.4 2.6-3.1 3.3-4.9.4-1.8.5-3.6.2-5.4L22 7l-10-5z"/>
						 </svg>
					   </div>`,
				className: 'rover-marker',
				iconSize: [20, 20],
				iconAnchor: [10, 10]
			});
			
			L.marker([roverGpsPosition.lat, roverGpsPosition.lng], { icon: roverIcon })
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
		currentCamera = cameraNumber;
	}
	
	function emergencyStop() {
		// TODO: Implement emergency stop
		console.log('Emergency stop triggered');
	}
</script>

<div class="min-h-screen bg-base-200 p-4">
	<!-- Launch Success Notification -->
	{#if notification?.show}
		<div class="notification-banner">
			<div class="notification-content">
				<div class="notification-icon">
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
				</div>
				<div class="notification-text">
					<h3 class="notification-title">🚀 Launch Successful!</h3>
					<p class="notification-message">{notification.message}</p>
					<p class="notification-details">The rover is now autonomously navigating to its destination.</p>
				</div>
				<button class="notification-close" onclick={dismissNotification} aria-label="Dismiss notification">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
					</svg>
				</button>
			</div>
		</div>
	{/if}

	<!-- Main Dashboard Grid -->
	<div class="space-y-6 max-w-none mx-4">
		<!-- Top Row - Camera and Map -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Live Camera Section -->
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h2 class="card-title text-xl mb-4">Live Camera</h2>
					
					<!-- Camera Feed Display -->
					<div class="aspect-video bg-gray-300 rounded-lg mb-4 flex items-center justify-center">
						<div class="text-center text-gray-600">
							<svg class="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
							</svg>
							<p>Camera {currentCamera} Feed</p>
							<p class="text-sm">Streaming from /camera{currentCamera}/image_raw</p>
						</div>
					</div>
					
					<!-- Camera Switch Buttons -->
					<div class="flex gap-2 justify-center">
						<button 
							class="btn {currentCamera === 1 ? 'btn-primary' : 'btn-outline'}"
							onclick={() => switchCamera(1)}
						>
							Camera 1
						</button>
						<button 
							class="btn {currentCamera === 2 ? 'btn-primary' : 'btn-outline'}"
							onclick={() => switchCamera(2)}
						>
							Camera 2
						</button>
					</div>
				</div>
			</div>

			<!-- Map Section -->
			<div class="card bg-base-100 shadow-xl h-fit">
				<div class="card-body">
					<h2 class="card-title text-xl mb-4">MAP of where rover is</h2>

					<!-- Leaflet Map Display -->
					<div class="aspect-video rounded-lg overflow-hidden mb-4 relative">
						<div bind:this={mapContainer} class="w-full h-full z-0"></div>
					</div>
				</div>
			</div>
		</div>

		<!-- Bottom Row - Live Data, Data Table, Navigation -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- 2d Lidar Section -->
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h2 class="card-title text-xl mb-4">2d Lidar</h2>
					
					<div class="grid grid-cols-1 gap-2 mb-4">
						<div class="stat">
							<div class="stat-title text-sm">IMU</div>
							<div class="stat-value text-lg">{sensorData.imu}</div>
						</div>
						<div class="stat">
							<div class="stat-title text-sm">TEMP</div>
							<div class="stat-value text-lg">{sensorData.temperature}°C</div>
						</div>
						<div class="stat">
							<div class="stat-title text-sm">Battery</div>
							<div class="stat-value text-lg">{sensorData.battery}%</div>
						</div>
					</div>
					
					<!-- Lidar Visualization -->
					<div class="flex justify-center">
						<div class="w-24 h-24 relative">
							<svg class="w-full h-full" viewBox="0 0 96 96">
								<!-- Grid lines -->
								<circle cx="48" cy="48" r="24" fill="none" stroke="#e5e7eb" stroke-width="1"/>
								<circle cx="48" cy="48" r="36" fill="none" stroke="#e5e7eb" stroke-width="1"/>
								<line x1="12" y1="48" x2="84" y2="48" stroke="#e5e7eb" stroke-width="1"/>
								<line x1="48" y1="12" x2="48" y2="84" stroke="#e5e7eb" stroke-width="1"/>
								
								<!-- Lidar beam -->
								<line 
									x1="48" 
									y1="48" 
									x2={48 + 30 * Math.cos((sensorData.lidarAngle - 90) * Math.PI / 180)} 
									y2={48 + 30 * Math.sin((sensorData.lidarAngle - 90) * Math.PI / 180)} 
									stroke="#3b82f6" 
									stroke-width="2"
								/>
								
								<!-- Center dot -->
								<circle cx="48" cy="48" r="2" fill="#3b82f6"/>
							</svg>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Data Table Section -->
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h2 class="card-title text-xl mb-4">Data Table</h2>
					<div class="overflow-x-auto">
						<table class="table table-zebra w-full">
							<thead>
								<tr>
									<th>ID</th>
									<th>Value</th>
									<th>Status</th>
								</tr>
							</thead>
							<tbody>
								{#each tableData as row}
									<tr>
										<td>{row.id}</td>
										<td>{row.value}</td>
										<td>
											<span class="badge badge-outline">{row.status}</span>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
			
			<!-- Navigation Controls -->
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h2 class="card-title text-xl mb-4">Navigation</h2>
					<p class="text-sm text-gray-600 mb-4">To controls page:</p>
					<div class="space-y-3">
						<a href="/manual-ctrl" class="btn btn-primary w-full">Manual Control</a>
						<button 
							class="btn btn-error w-full"
							onclick={emergencyStop}
						>
							E-Stop
						</button>
					</div>
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
		background: linear-gradient(135deg, #10b981, #059669);
		color: white;
		padding: 16px 20px;
		border-radius: 12px;
		box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
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
</style>