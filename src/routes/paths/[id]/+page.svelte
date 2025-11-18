<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, tick } from 'svelte';

	export let data: { path: any };

	let coords: { lat: number; lng: number }[] = [];
	let map: L.Map;
	let mapContainer: HTMLElement;
	let mapInitialized = false;
	
	let logsMap: L.Map;
	let logsMapContainer: HTMLElement;
	let logsMapInitialized = false;

	// Parse coordinates when data is available
	$: if (data.path.route && data.path.route.coordinates && Array.isArray(data.path.route.coordinates)) {
		coords = data.path.route.coordinates.map((c: any) => ({ lat: c[1], lng: c[0] }));
		// console.log('Parsed coords:', coords);
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
				html: '<div style="background-color: #22c55e; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
				className: '',
				iconSize: [16, 16]
			});
			L.marker([coords[0].lat, coords[0].lng], { icon: startIcon })
				.addTo(map)
				.bindPopup('Start');

			// Add end marker (red)
			const endIcon = L.divIcon({
				html: '<div style="background-color: #ef4444; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
				className: '',
				iconSize: [16, 16]
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

	// Initialize logs map
	$: if (logsMapContainer && data.path.logs && data.path.logs.length > 0 && !logsMapInitialized) {
		initializeLogsMap();
	}

	async function initializeLogsMap() {
		console.log('=== Logs Map Initialization Start ===');
		
		try {
			await tick();
			const L = (await import('leaflet')).default;

			// Filter logs with valid locations
			const validLogs = data.path.logs.filter((log: any) => 
				log.location?.coordinates && 
				Array.isArray(log.location.coordinates) &&
				log.location.coordinates.length === 2
			);

			if (validLogs.length === 0) {
				console.log('No valid log locations found');
				return;
			}

			// Filter out similar locations (within ~10 meters)
			const threshold = 0.0001; // approximately 10-11 meters
			const uniqueLogs: any[] = [];
			
			for (const log of validLogs) {
				const [lng, lat] = log.location.coordinates;
				const isDuplicate = uniqueLogs.some((uniqueLog: any) => {
					const [uLng, uLat] = uniqueLog.location.coordinates;
					const latDiff = Math.abs(lat - uLat);
					const lngDiff = Math.abs(lng - uLng);
					return latDiff < threshold && lngDiff < threshold;
				});
				
				if (!isDuplicate) {
					uniqueLogs.push(log);
				}
			}

			console.log(`Filtered from ${validLogs.length} to ${uniqueLogs.length} unique locations`);

			const firstLog = uniqueLogs[0];
			const [firstLng, firstLat] = firstLog.location.coordinates;

			// Initialize logs map
			logsMap = L.map(logsMapContainer).setView([firstLat, firstLng], 15);
			
			// Add tile layer
			L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
				attribution:
					'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
				subdomains: 'abcd',
				maxZoom: 20
			}).addTo(logsMap);

			// Create markers for each unique log
			const markerIcon = L.divIcon({
				html: '<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
				className: '',
				iconSize: [16, 16]
			});

			const allLatLngs: [number, number][] = [];

			uniqueLogs.forEach((log: any) => {
				const [lng, lat] = log.location.coordinates;
				allLatLngs.push([lat, lng]);

				const popupContent = `
					<div style="font-size: 12px;">
						<strong>Log #${log.id}</strong><br/>
						<strong>Time:</strong> ${log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}<br/>
						<strong>Temperature:</strong> ${log.temperature != null ? log.temperature.toFixed(2) + '°C' : 'N/A'}<br/>
						<strong>Voltage:</strong> ${log.voltage != null ? log.voltage.toFixed(2) + 'V' : 'N/A'}
					</div>
				`;

				L.marker([lat, lng], { icon: markerIcon })
					.addTo(logsMap)
					.bindPopup(popupContent);
			});

			// Draw polyline connecting the logs
			if (allLatLngs.length > 1) {
				L.polyline(allLatLngs, {
					color: '#3b82f6',
					weight: 2,
					opacity: 0.5
				}).addTo(logsMap);
			}

			// Fit map bounds to show all markers
			const bounds = L.latLngBounds(allLatLngs);
			logsMap.fitBounds(bounds, { padding: [30, 30] });

			// Invalidate size to fix rendering issues
			setTimeout(() => {
				logsMap.invalidateSize();
				console.log('Logs map size invalidated');
			}, 100);

			logsMapInitialized = true;
			console.log('=== Logs Map Initialization Complete ===');
		} catch (error) {
			console.error('Error initializing logs map:', error);
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

		<!-- Logs section -->
		{#if data.path.logs && data.path.logs.length > 0}
			<div class="rounded-2xl border border-green-100 bg-white p-6 shadow-lg mb-6">
				<h2 class="mb-4 text-xl font-bold text-green-900">Associated Logs ({data.path.logs.length})</h2>
				
				<div class="overflow-x-auto">
					<table class="w-full border-collapse text-sm">
						<thead>
							<tr class="border-b-2 border-green-200 bg-green-50">
								<th class="text-left px-4 py-2 font-semibold text-green-900">ID</th>
								<th class="text-left px-4 py-2 font-semibold text-green-900">Timestamp</th>
								<th class="text-left px-4 py-2 font-semibold text-green-900">Location</th>
								<th class="text-right px-4 py-2 font-semibold text-green-900">Altitude (m)</th>
								<th class="text-right px-4 py-2 font-semibold text-green-900">Roll (°)</th>
								<th class="text-right px-4 py-2 font-semibold text-green-900">Pitch (°)</th>
								<th class="text-right px-4 py-2 font-semibold text-green-900">Yaw (°)</th>
								<th class="text-right px-4 py-2 font-semibold text-green-900">Temp (°C)</th>
								<th class="text-right px-4 py-2 font-semibold text-green-900">Voltage (V)</th>
							</tr>
						</thead>
						<tbody>
							{#each data.path.logs as log, i}
								<tr class={`border-b border-green-100 ${i % 2 === 0 ? 'bg-white' : 'bg-green-50/30'} hover:bg-green-100 transition-colors`}>
									<td class="px-4 py-3 text-green-900">{log.id}</td>
									<td class="px-4 py-3 text-green-900 font-mono text-xs">{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}</td>
									<td class="px-4 py-3">
										{#if log.location?.coordinates}
											<span class="font-mono text-xs text-green-700">
												{log.location.coordinates[1].toFixed(4)}, {log.location.coordinates[0].toFixed(4)}
											</span>
										{:else}
											<span class="text-gray-400">N/A</span>
										{/if}
									</td>
									<td class="px-4 py-3 text-right text-green-900">{log.altitude?.toFixed(2) ?? 'N/A'}</td>
									<td class="px-4 py-3 text-right text-green-900">{log.roll?.toFixed(2) ?? 'N/A'}</td>
									<td class="px-4 py-3 text-right text-green-900">{log.pitch?.toFixed(2) ?? 'N/A'}</td>
									<td class="px-4 py-3 text-right text-green-900">{log.yaw?.toFixed(2) ?? 'N/A'}</td>
									<td class="px-4 py-3 text-right text-green-900">{log.temperature?.toFixed(2) ?? 'N/A'}</td>
									<td class="px-4 py-3 text-right text-green-900">{log.voltage?.toFixed(2) ?? 'N/A'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Explored Path Map -->
			<div class="rounded-2xl border border-green-100 bg-white p-6 shadow-lg">
				<h2 class="mb-4 text-xl font-bold text-green-900">Explored Path by the Rover</h2>
				<div class="rounded-lg overflow-hidden border border-green-200 shadow-sm">
					<div bind:this={logsMapContainer} id="logs-map" class="w-full h-96"></div>
				</div>
				<p class="mt-2 text-sm text-green-600">Hover over markers to see temperature and voltage data. Similar locations are filtered to prevent overlap.</p>
			</div>
		{:else}
			<div class="rounded-2xl border border-green-100 bg-white p-6 shadow-lg">
				<p class="text-green-600">No logs available for this path.</p>
			</div>
		{/if}
	</div>
</main>
