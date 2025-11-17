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

	// Get the query parameters from the URL (where we came from)
	$: roverId = $page.url.searchParams.get('roverId');
	$: imageId = $page.url.searchParams.get('imageId');
	$: pathId = $page.url.searchParams.get('pathId');

	// Leaflet map variables
	let mapContainer: HTMLElement;
	let map: any;
	let L: any;
	let detectionMarker: any = null;

	// Image dimensions for bounding box
	let imgElement: HTMLImageElement;
	let imageWidth = 0;
	let imageHeight = 0;

	function handleImageLoad(event: Event) {
		const img = event.target as HTMLImageElement;
		imageWidth = img.naturalWidth;
		imageHeight = img.naturalHeight;
	}

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
		// If we came from a pothole page (imageId present), go back to that pothole page
		if (imageId) {
			goto(`/potholes/${imageId}`);
		} else if (pathId) {
			// If we came from a specific path page (pathId present), go back to that rover/path page
			const targetRoverId = roverId || data.rover.id;
			goto(`/rovers/${targetRoverId}/${pathId}`);
		} else {
			// Otherwise, go to the rover page (from the data table on rover live metrics)
			const targetRoverId = roverId || data.rover.id;
			goto(`/rovers/${targetRoverId}`);
		}
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

			detectionMarker = L.marker([data.image.location[0], data.image.location[1]], {
				icon: detectionIcon
			})
				.addTo(map)
				.bindPopup(
					`Detection #${data.detection.id}<br>Confidence: ${formatPercentage(data.detection.confidence)}`
				);

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
				class="flex items-center gap-2 font-medium text-purple-600 transition-colors hover:text-purple-700"
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
				Back
			</button>
		</div>

		<!-- Main Content Card -->
		<div class="overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-lg">
			<!-- Header Section -->
			<div class="bg-gradient-to-r from-purple-600 to-purple-700 px-8 py-6">
				<h1 class="mb-2 text-3xl font-bold text-white">Detection Details</h1>
				<p class="text-purple-100">Detection ID: #{data.detection.id}</p>
			</div>

			<!-- Content Grid -->
			<div class="grid grid-cols-1 gap-8 p-8 lg:grid-cols-2">
				<!-- Image Section -->
				<div class="space-y-4">
					<div class="relative overflow-hidden rounded-xl border-2 border-purple-200 bg-purple-50">
						<img
							bind:this={imgElement}
							on:load={handleImageLoad}
							src="/{data.image.imageUrl}"
							alt="Detection {data.detection.id}"
							class="h-auto w-full object-contain"
						/>
						<!-- Bounding Box Overlay -->
						{#if imageWidth > 0 && imageHeight > 0}
							<svg
								class="pointer-events-none absolute left-0 top-0 h-full w-full"
								viewBox="0 0 {imageWidth} {imageHeight}"
								preserveAspectRatio="none"
							>
								<rect
									x={data.detection.bbox[0]}
									y={data.detection.bbox[1]}
									width={data.detection.bbox[2] - data.detection.bbox[0]}
									height={data.detection.bbox[3] - data.detection.bbox[1]}
									fill="none"
									stroke="rgb(74, 222, 128)"
									stroke-width="4"
									vector-effect="non-scaling-stroke"
								/>
							</svg>
						{/if}
					</div>
					<div class="rounded-lg border border-purple-200 bg-purple-50 p-4">
						<h3 class="mb-2 font-semibold text-purple-900">Image Information</h3>
						<div class="space-y-2 text-sm">
							<div class="flex justify-between">
								<span class="text-purple-600">Image ID:</span>
								<span class="font-medium text-purple-900">#{data.image.id}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-purple-600">Captured:</span>
								<span class="font-medium text-purple-900">{formatDate(data.image.timestamp)}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-purple-600">Location:</span>
								<span class="font-mono text-xs text-purple-900"
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
					<div
						class="overflow-hidden rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white"
					>
						<div class="border-b border-purple-200 bg-purple-100 p-4">
							<h2 class="text-lg font-bold text-purple-900">Detection Location</h2>
						</div>
						<div bind:this={mapContainer} class="h-64 w-full"></div>
					</div>

					<!-- Detection Metrics -->
					<div class="rounded-xl border-2 border-purple-300 bg-white p-6 shadow-md">
						<h2 class="mb-4 text-xl font-bold text-purple-900">Detection Metrics</h2>
						<div class="space-y-3">
							<!-- Confidence Score -->
							<div
								class="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 shadow-sm"
							>
								<span class="font-semibold text-purple-800">Confidence Score</span>
								<span class="text-xl font-bold text-purple-900"
									>{(data.detection.confidence * 100).toFixed(1)}%</span
								>
							</div>

							<!-- Area Severity -->
							{#if data.detection.areaScore !== null}
								<div
									class="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 shadow-sm"
								>
									<span class="font-semibold text-purple-800">Area Severity</span>
									<span class="text-xl font-bold text-purple-900"
										>{data.detection.areaScore.toFixed(2)} / 1</span
									>
								</div>
							{/if}

							<!-- Depth Severity -->
							{#if data.detection.depthScore !== null}
								<div
									class="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 shadow-sm"
								>
									<span class="font-semibold text-purple-800">Depth Severity</span>
									<span class="text-xl font-bold text-purple-900"
										>{data.detection.depthScore.toFixed(2)} / 1</span
									>
								</div>
							{/if}

							<!-- False Positive Status -->
							{#if data.detection.falsePositive !== null}
								<div
									class="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 shadow-sm"
								>
									<span class="font-semibold text-purple-800">False Positive</span>
									<span class="text-xl font-bold text-purple-900">
										{data.detection.falsePositive === 1 ? 'Yes' : 'No'}
									</span>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</main>
