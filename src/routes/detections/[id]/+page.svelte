<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	export let data: {
		detection: {
			id: number;
			bbox: number[];
			confidence: number;
			areaScore: number | null;
			depthScore: number | null;
			falsePositive: number | null;
		};
		image: {
			id: number;
			imageUrl: string;
			timestamp: Date;
			location: [number, number];
		};
		path: {
			id: number;
			timestamp: Date;
		};
		rover: {
			id: number;
			name: string;
			ipAddress: string;
		};
	};

	// Get the rover ID from the URL query parameter (where we came from)
	$: roverId = $page.url.searchParams.get('roverId');

	// Leaflet map variables
	let mapContainer: HTMLElement;
	let map: any;
	let L: any;
	let detectionMarker: any = null;

	function formatDate(date: Date | string): string {
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatCoordinate(coord: number): string {
		return coord.toFixed(6);
	}

	function formatPercentage(value: number): string {
		return (value * 100).toFixed(2) + '%';
	}

	function goBack() {
		// Use the rover ID from query param if available, otherwise use the one from detection data
		const targetRoverId = roverId || data.rover.id;
		goto(`/rovers/${targetRoverId}`);
	}

	onMount(async () => {
		// Import Leaflet CSS
		if (browser) {
			await import('leaflet/dist/leaflet.css');
		}

		// Initialize the map after the component mounts
		if (browser && mapContainer) {
			setTimeout(initializeMap, 50);
		}
	});

	async function initializeMap() {
		try {
			// Dynamically import Leaflet
			L = await import('leaflet');

			// Initialize the map centered on the detection location
			map = L.map(mapContainer).setView([data.image.location[0], data.image.location[1]], 16);

			// Add tile layer
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '© OpenStreetMap contributors'
			}).addTo(map);

			// Create a custom icon using an image from the static folder
			const detectionIcon = L.icon({
				iconUrl: '/detection-pin.png',
				iconSize: [60, 60],
				iconAnchor: [20, 60],
				popupAnchor: [0, -60]
			});

			detectionMarker = L.marker([data.image.location[0], data.image.location[1]], { icon: detectionIcon })
				.addTo(map)
				.bindPopup(`Detection #${data.detection.id}<br>Confidence: ${formatPercentage(data.detection.confidence)}`);

			// Invalidate map size after a short delay to ensure container is sized
			setTimeout(() => {
				map.invalidateSize();
			}, 100);
		} catch (error) {
			console.error('Error initializing map:', error);
		}
	}
</script>

<main class="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 p-8">
	<div class="container mx-auto max-w-6xl">
		<!-- Header with Back Button -->
		<div class="mb-6">
			<button
				on:click={goBack}
				class="flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium transition-colors"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
						clip-rule="evenodd"
					/>
				</svg>
				Back to Rover
			</button>
		</div>

		<!-- Main Content Card -->
		<div class="bg-white rounded-2xl shadow-lg border border-purple-100 overflow-hidden">
			<!-- Header Section -->
			<div class="bg-gradient-to-r from-purple-600 to-purple-700 px-8 py-6">
				<h1 class="text-3xl font-bold text-white mb-2">Detection Details</h1>
				<p class="text-purple-100">Detection ID: #{data.detection.id}</p>
			</div>

			<!-- Content Grid -->
			<div class="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
				<!-- Image Section -->
				<div class="space-y-4">
					<div class="bg-purple-50 rounded-xl overflow-hidden border-2 border-purple-200 relative">
						<img
							src="/{data.image.imageUrl}"
							alt="Detection {data.detection.id}"
							class="w-full h-auto object-contain"
						/>
						<!-- Bounding Box Overlay -->
						<svg
							class="absolute top-0 left-0 w-full h-full pointer-events-none"
							viewBox="0 0 100 100"
							preserveAspectRatio="none"
						>
							<rect
								x="{data.detection.bbox[0]}"
								y="{data.detection.bbox[1]}"
								width="{data.detection.bbox[2] - data.detection.bbox[0]}"
								height="{data.detection.bbox[3] - data.detection.bbox[1]}"
								fill="none"
								stroke="rgb(74, 222, 128)"
								stroke-width="4"
								vector-effect="non-scaling-stroke"
							/>
						</svg>
					</div>
					<div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
						<h3 class="font-semibold text-purple-900 mb-2">Image Information</h3>
						<div class="space-y-2 text-sm">
							<div class="flex justify-between">
								<span class="text-purple-600">Image ID:</span>
								<span class="text-purple-900 font-medium">#{data.image.id}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-purple-600">Captured:</span>
								<span class="text-purple-900 font-medium"
									>{formatDate(data.image.timestamp)}</span
								>
							</div>
							<div class="flex justify-between">
								<span class="text-purple-600">Location:</span>
								<span class="text-purple-900 font-mono text-xs"
									>[{formatCoordinate(data.image.location[0])}, {formatCoordinate(
										data.image.location[1]
									)}]</span
								>
							</div>
						</div>
					</div>
				</div>

				<!-- Detection Details Section -->
				<div class="space-y-6">
					<!-- Location Map -->
					<div class="bg-gradient-to-br from-purple-50 to-white border border-purple-200 rounded-xl overflow-hidden">
						<div class="p-4 bg-purple-100 border-b border-purple-200">
							<h2 class="text-lg font-bold text-purple-900">Detection Location</h2>
						</div>
						<div bind:this={mapContainer} class="w-full h-64"></div>
					</div>

					<!-- Detection Metrics -->
					<div class="bg-white border-2 border-purple-300 rounded-xl p-6 shadow-md">
						<h2 class="text-xl font-bold text-purple-900 mb-4">Detection Metrics</h2>
						<div class="space-y-3">
							<!-- Confidence Score -->
							<div class="flex justify-between items-center py-3 px-4 bg-purple-50 rounded-lg border border-purple-200 shadow-sm">
								<span class="text-purple-800 font-semibold">Confidence Score</span>
								<span class="text-xl font-bold text-purple-900"
									>{formatPercentage(data.detection.confidence)}</span
								>
							</div>

							<!-- Area Score -->
							{#if data.detection.areaScore !== null}
								<div class="flex justify-between items-center py-3 px-4 bg-purple-50 rounded-lg border border-purple-200 shadow-sm">
									<span class="text-purple-800 font-semibold">Area Score</span>
									<span class="text-xl font-bold text-purple-900"
										>{formatPercentage(data.detection.areaScore)}</span
									>
								</div>
							{/if}

							<!-- Depth Score -->
							{#if data.detection.depthScore !== null}
								<div class="flex justify-between items-center py-3 px-4 bg-purple-50 rounded-lg border border-purple-200 shadow-sm">
									<span class="text-purple-800 font-semibold">Depth Score</span>
									<span class="text-xl font-bold text-purple-900"
										>{formatPercentage(data.detection.depthScore)}</span
									>
								</div>
							{/if}

							<!-- False Positive Status -->
							{#if data.detection.falsePositive !== null}
								<div class="pt-2">
									<div
										class="flex items-center gap-2 px-4 py-3 rounded-lg {data.detection
											.falsePositive === 1
											? 'bg-amber-50 border border-amber-200'
											: 'bg-blue-50 border border-blue-200'}"
									>
										<div
											class="w-3 h-3 rounded-full {data.detection.falsePositive === 1
												? 'bg-amber-500'
												: 'bg-blue-500'}"
										></div>
										<span
											class="font-semibold {data.detection.falsePositive === 1
												? 'text-amber-800'
												: 'text-blue-800'}"
										>
											{data.detection.falsePositive === 1 ? 'Possibly False Positive' : 'Likely Valid Detection'}
										</span>
									</div>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</main>
