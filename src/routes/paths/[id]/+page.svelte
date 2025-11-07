<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, tick } from 'svelte';

	export let data: { path: any };

	let coords: { lat: number; lng: number }[] = [];
	let map: L.Map;
	let mapContainer: HTMLElement;
	let mapInitialized = false;

	// Parse coordinates when data is available
	$: if (data.path.route && data.path.route.coordinates && Array.isArray(data.path.route.coordinates)) {
		coords = data.path.route.coordinates.map((c: any) => ({ lat: c[1], lng: c[0] }));
		console.log('Parsed coords:', coords);
	}

	// Initialize map when container is ready and we have coordinates
	$: if (mapContainer && coords.length > 0 && !mapInitialized) {
		initializeMap();
	}

	async function initializeMap() {
		console.log('=== Map Initialization Start ===');
		console.log('Map container:', mapContainer);
		console.log('Container dimensions:', {
			width: mapContainer.offsetWidth,
			height: mapContainer.offsetHeight
		});
		console.log('Coordinates:', coords);

		try {
			// Wait for DOM to be fully ready
			await tick();

			const L = (await import('leaflet')).default;
			console.log('Leaflet loaded');

			// Load Leaflet CSS
			if (!document.getElementById('leaflet-css')) {
				const link = document.createElement('link');
				link.id = 'leaflet-css';
				link.rel = 'stylesheet';
				link.href = 'https://unpkg.com/leaflet/dist/leaflet.css';
				document.head.appendChild(link);
				console.log('Leaflet CSS added');
			}

			// Wait a bit more for CSS to load
			await new Promise(resolve => setTimeout(resolve, 100));

			// Initialize map centered on first coordinate
			console.log('Creating map at coords:', [coords[0].lat, coords[0].lng]);
			map = L.map(mapContainer).setView([coords[0].lat, coords[0].lng], 15);
			console.log('Map created');
			
			// Add tile layer
			console.log('Adding tile layer...');
			L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
				attribution:
					'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
				subdomains: 'abcd',
				maxZoom: 20
			}).addTo(map);
			console.log('Tile layer added');

			// Add start marker (green)
			const startIcon = L.divIcon({
				html: '<div style="background-color: #22c55e; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
				className: '',
				iconSize: [12, 12]
			});
			L.marker([coords[0].lat, coords[0].lng], { icon: startIcon })
				.addTo(map)
				.bindPopup('Start');

			// Add end marker (red)
			const endIcon = L.divIcon({
				html: '<div style="background-color: #ef4444; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
				className: '',
				iconSize: [12, 12]
			});
			L.marker([coords[coords.length - 1].lat, coords[coords.length - 1].lng], { icon: endIcon })
				.addTo(map)
				.bindPopup('End');

			// Draw the route as a polyline
			console.log('Drawing route polyline...');
			const latLngs: [number, number][] = coords.map((c) => [c.lat, c.lng]);
			L.polyline(latLngs, {
				color: '#3b82f6',
				weight: 3,
				opacity: 0.7
			}).addTo(map);
			console.log('Polyline added');

			// Fit map bounds to show entire route
			const bounds = L.latLngBounds(latLngs);
			map.fitBounds(bounds, { padding: [20, 20] });

			// Invalidate size to fix rendering issues
			setTimeout(() => {
				map.invalidateSize();
				console.log('Map size invalidated');
			}, 100);

			mapInitialized = true;
			console.log('=== Map Initialization Complete ===');
		} catch (error) {
			console.error('Error initializing map:', error);
		}
	}

	function goBack() {
		history.back();
	}
</script>

<main class="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 p-8">
	<div class="container mx-auto max-w-6xl">
		<div class="mb-6 rounded-2xl border border-green-100 bg-white p-6 shadow-lg">
			<button on:click={goBack} class="mb-4 text-sm text-green-600">← Back</button>
			<h1 class="mb-4 text-2xl font-bold text-green-900">Path #{data.path.id}</h1>
			
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<!-- Left side: Path information -->
				<div>
					<div class="mb-4">
						<strong>Rover ID:</strong> {data.path.rover_id}
					</div>
					<div class="mb-4">
						<strong>Timestamp:</strong> {data.path.timestamp ? new Date(data.path.timestamp).toString() : 'N/A'}
					</div>

					{#if coords.length > 0}
						<div class="mb-4">
							<strong>Coordinates ({coords.length} points):</strong>
							<div class="max-h-64 overflow-y-auto mt-2">
								<ul class="list-disc ml-6">
									{#each coords as c, i}
										<li class="font-mono text-sm text-green-900">
											{#if i === 0}
												<span class="text-green-600 font-semibold">Start:</span>
											{:else if i === coords.length - 1}
												<span class="text-red-600 font-semibold">End:</span>
											{/if}
											{c.lat}, {c.lng}
										</li>
									{/each}
								</ul>
							</div>
						</div>
					{:else}
						<div class="rounded-lg border border-green-200 bg-green-50 p-4">No route coordinates available.</div>
					{/if}
				</div>

				<!-- Right side: Map -->
				<div>
					{#if coords.length > 0}
						<div class="rounded-lg overflow-hidden border border-green-200 shadow-sm">
							<div bind:this={mapContainer} id="map" class="w-full h-96"></div>
						</div>
					{:else}
						<div class="rounded-lg border border-green-200 bg-gray-50 p-4 h-96 flex items-center justify-center text-gray-500">
							No route to display
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</main>
