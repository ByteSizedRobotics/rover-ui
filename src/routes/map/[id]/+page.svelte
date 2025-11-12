<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import { calculateTravelTimeSeconds, formatDuration } from '$lib/utils/roverEnergy';

	const params = get(page).params;
	const roverId = params.id;

	let map: L.Map;
	let geocoder: any;
	let routingControl: any;
	let startAddress = '';
	let endAddress = '';
	let startSuggestions: NominatimResult[] = [];
	let endSuggestions: NominatimResult[] = [];
	let showStartSuggestions = false;
	let showEndSuggestions = false;
	let routeSelected = false;
	let lastRoutes: any[] = [];
	let routeDistanceMeters = 0;
	let roverSpeed = 0.5;

	// Derived metrics for informing the operator about the planned route
	let estimatedTravelSeconds = 0;
	let durationBreakdown = { hours: 0, minutes: 0, seconds: 0 };

	const MAX_OPERATION_SECONDS = 3600; // 1 hour threshold for warnings

	// Type definitions for Nominatim results
	interface NominatimAddress {
		house_number?: string;
		road?: string;
		street?: string;
		city?: string;
		town?: string;
		village?: string;
		state?: string;
		province?: string;
		country?: string;
		postcode?: string;
		[key: string]: string | undefined;
	}

	interface NominatimResult {
		place_id: number;
		lat: string;
		lon: string;
		display_name: string;
		address?: NominatimAddress;
		[key: string]: any;
	}

	interface GeoLocation {
		lat: number;
		lng: number;
	}

	onMount(async () => {
		const L = (await import('leaflet')).default;

		// Load Leaflet CSS
		if (!document.getElementById('leaflet-css')) {
			const link = document.createElement('link');
			link.id = 'leaflet-css';
			link.rel = 'stylesheet';
			link.href = 'https://unpkg.com/leaflet/dist/leaflet.css';
			document.head.appendChild(link);
		}

		// Load Routing Machine CSS
		if (!document.getElementById('leaflet-routing-machine-css')) {
			const link = document.createElement('link');
			link.id = 'leaflet-routing-machine-css';
			link.rel = 'stylesheet';
			link.href = 'https://unpkg.com/leaflet-routing-machine/dist/leaflet-routing-machine.css';
			document.head.appendChild(link);
		}

		// Initialize map
		map = L.map('map').setView([45.4215, -75.6972], 13);
		L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
			subdomains: 'abcd',
			maxZoom: 20
		}).addTo(map);

		// Import additional Leaflet components
		await import('leaflet-routing-machine');
		await import('leaflet-control-geocoder');

		// Properly instantiate Nominatim geocoder
		geocoder = new L.Control.Geocoder.Nominatim();

		// Initialize routing control (empty waypoints initially)
		routingControl = L.Routing.control({
			waypoints: [],
			routeWhileDragging: true
		}).addTo(map);

		// store routes when found so we can extract full geometry later
		routingControl.on('routesfound', (e: any) => {
			lastRoutes = e.routes || [];
			routeDistanceMeters = extractRouteDistance(lastRoutes);
			updateRouteEstimates();
			console.log('routesfound event, saved lastRoutes', lastRoutes);
		});

		console.log('Map, geocoder, and routing control initialized.');
	});

	async function setRoute(): Promise<void> {
		if (!startAddress || !endAddress) {
			alert('Please enter both a start and an end location.');
			return;
		}

		console.log(`Geocoding start: ${startAddress}`);
		console.log(`Geocoding end: ${endAddress}`);

		try {
			const startCoords = await geocodeAddress(startAddress);
			const endCoords = await geocodeAddress(endAddress);

			if (startCoords && endCoords) {
				console.log('Geocoding successful!', { startCoords, endCoords });

				// Update route waypoints
				routingControl.setWaypoints([
					L.latLng(startCoords.lat, startCoords.lng),
					L.latLng(endCoords.lat, endCoords.lng)
				]);

				// Center map on the start location
				map.setView(startCoords, 13);

				// Mark that a route has been selected so UI can show Launch button
				routeSelected = true;
				routeDistanceMeters = 0;
				updateRouteEstimates();

				// Check if route is actually drawn
				console.log('Waypoints set:', routingControl.getWaypoints());
			}
		} catch (error) {
			alert('Error finding locations. Please check your addresses.');
			console.error(error);
		}
	}

	function launchRover(): void {
		if (!lastRoutes || lastRoutes.length === 0) {
			alert('No route available. Please set a route first.');
			return;
		}

		// Extract an array of LatLng waypoints from the first route's coordinates
		const route = lastRoutes[0];
		let waypoints: { lat: number; lng: number }[] = [];

		// Some routers provide coordinates as route.coordinates (array of [lng, lat])
		if (route.coordinates && Array.isArray(route.coordinates)) {
			waypoints = route.coordinates.map((c: any) => ({ lat: c.lat, lng: c.lng }));
		} else if (route.geometry && route.geometry.coordinates) {
			// GeoJSON style
			waypoints = route.geometry.coordinates.map((c: any) => ({ lat: c[1], lng: c[0] }));
		} else if (route.instructions || route.routes) {
			// Fallback: try to extract from legs -> steps -> latLng
			try {
				for (const leg of route.instructions || []) {
					if (leg.coordinates) {
						for (const c of leg.coordinates)
							waypoints.push({ lat: c.lat || c[1], lng: c.lng || c[0] });
					}
				}
			} catch (err) {
				console.warn('Could not parse route coordinates from route object', err);
			}
		}

		if (waypoints.length === 0) {
			alert('Could not extract GPS waypoints from the planned route.');
			return;
		}

		// Save waypoints and start/end to sessionStorage under a key the next page can read
		const key = `launch_waypoints_${roverId}`;
		const payload = {
			waypoints,
			start: startAddress,
			end: endAddress,
			roverSpeed,
			estimatedTravelSeconds
		};
		try {
			sessionStorage.setItem(key, JSON.stringify(payload));
		} catch (err) {
			console.error('Unable to save waypoints to sessionStorage', err);
			alert('Unable to save waypoints locally.');
			return;
		}

		// Navigate to the launch page for that rover id
		window.location.href = `/launch-rover/${encodeURIComponent(roverId)}`;
	}

	async function geocodeAddress(address: string): Promise<GeoLocation> {
		console.log(`Geocoding address: ${address}`);
		const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
		const response = await fetch(url);
		const results: NominatimResult[] = await response.json();
		console.log(`Geocode results for "${address}":`, results);
		if (results.length > 0) {
			return {
				lat: parseFloat(results[0].lat),
				lng: parseFloat(results[0].lon)
			};
		} else {
			alert(`Could not find location: ${address}`);
			throw new Error(`No results found for "${address}"`);
		}
	}

	async function fetchSuggestions(query: string): Promise<NominatimResult[]> {
		if (!query || query.trim().length < 2) return [];

		try {
			// Use Nominatim's search endpoint with optimized parameters
			// Key improvements:
			// - Higher limit (50) to get more diverse results before filtering
			// - dedupe=1 for server-side deduplication
			// - addressdetails=1 for structured address data
			// - countrycodes=ca to restrict to Canada
			const params = new URLSearchParams({
				format: 'json',
				q: query.trim(),
				addressdetails: '1',
				countrycodes: 'ca',
				limit: '50',
				dedupe: '1'
			});

			const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
			console.log('Fetching suggestions:', query);

			const response = await fetch(url, {
				headers: {
					'Accept-Language': 'en'
				}
			});

			if (!response.ok) {
				console.error('Nominatim API error:', response.status);
				return [];
			}

			let results: NominatimResult[] = await response.json();

			// Fast lightweight filtering - only keep diverse, relevant results
			const seen = new Set<string>();
			const filtered: NominatimResult[] = [];

			for (const result of results) {
				if (filtered.length >= 8) break; // Stop after getting 8 good results

				const addr = result.address || {};

				// Create a lightweight key for deduplication
				const road = addr.road || addr.street || '';
				const num = addr.house_number || '';
				const city = addr.city || addr.town || addr.village || '';

				// More flexible key - prioritize exact matches with house numbers
				const key = num ? `${num}|${road}|${city}` : `${road}|${city}`;

				if (!seen.has(key)) {
					seen.add(key);
					filtered.push(result);
				}
			}

			console.log(`Got ${filtered.length} suggestions`);
			return filtered;
		} catch (error) {
			console.error('Error fetching suggestions:', error);
			return [];
		}
	}

	// Debounce to avoid excessive API calls while maintaining responsiveness
	let startInputTimeout: ReturnType<typeof setTimeout> | null = null;

	async function handleStartInput(e: Event): Promise<void> {
		const target = e.target as HTMLInputElement;
		startAddress = target.value;

		if (startInputTimeout) clearTimeout(startInputTimeout);

		if (startAddress.trim().length < 2) {
			startSuggestions = [];
			showStartSuggestions = false;
			return;
		}

		startInputTimeout = setTimeout(async () => {
			startSuggestions = await fetchSuggestions(startAddress);
			showStartSuggestions = startSuggestions.length > 0;
		}, 200); // 200ms debounce - faster response
	}

	function formatSuggestion(suggestion: NominatimResult): string {
		const address = suggestion.address || {};
		let parts: string[] = [];

		// Add house number if available and relevant
		if (address.house_number) parts.push(address.house_number);

		// Add road/street name
		if (address.road) parts.push(address.road);
		else if (address.street) parts.push(address.street);

		// Add city/town/village
		if (address.city) parts.push(address.city);
		else if (address.town) parts.push(address.town);
		else if (address.village) parts.push(address.village);

		// Add province/state for Canadian addresses
		if (address.state) parts.push(address.state);
		else if (address.province) parts.push(address.province);

		return parts.length ? parts.join(', ') : suggestion.display_name;
	}

	function selectStartSuggestion(suggestion: NominatimResult): void {
		startAddress = formatSuggestion(suggestion);
		showStartSuggestions = false;
		startSuggestions = [];
	}

	// Debounce for end input
	let endInputTimeout: ReturnType<typeof setTimeout> | null = null;

	async function handleEndInput(e: Event): Promise<void> {
		const target = e.target as HTMLInputElement;
		endAddress = target.value;

		if (endInputTimeout) clearTimeout(endInputTimeout);

		if (endAddress.trim().length < 2) {
			endSuggestions = [];
			showEndSuggestions = false;
			return;
		}

		endInputTimeout = setTimeout(async () => {
			endSuggestions = await fetchSuggestions(endAddress);
			showEndSuggestions = endSuggestions.length > 0;
		}, 200); // 200ms debounce - faster response
	}

	function selectEndSuggestion(suggestion: NominatimResult): void {
		endAddress = formatSuggestion(suggestion);
		showEndSuggestions = false;
		endSuggestions = [];
	}

	function updateRouteEstimates(): void {
		estimatedTravelSeconds = calculateTravelTimeSeconds(routeDistanceMeters, roverSpeed);
		durationBreakdown = formatDuration(estimatedTravelSeconds);
	}

	function extractRouteDistance(routes: any[]): number {
		const primaryRoute = routes && routes.length > 0 ? routes[0] : null;

		if (!primaryRoute) return 0;

		const summaryDistance = primaryRoute.summary?.totalDistance;
		if (typeof summaryDistance === 'number' && summaryDistance > 0) {
			return summaryDistance;
		}

		// Fallback: approximate distance from coordinate pairs if summary missing
		const coords = primaryRoute.coordinates || primaryRoute.geometry?.coordinates;
		if (!Array.isArray(coords) || coords.length < 2) {
			return 0;
		}

		let distance = 0;
		for (let i = 1; i < coords.length; i += 1) {
			const prev = coords[i - 1];
			const curr = coords[i];
			const prevLat = prev.lat ?? prev[1];
			const prevLng = prev.lng ?? prev[0];
			const currLat = curr.lat ?? curr[1];
			const currLng = curr.lng ?? curr[0];

			if ([prevLat, prevLng, currLat, currLng].some((v) => typeof v !== 'number')) continue;

			distance += haversine(prevLat, prevLng, currLat, currLng);
		}

		return distance;
	}

	function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
		const R = 6371000; // Earth radius in meters
		const toRad = (deg: number) => (deg * Math.PI) / 180;
		const dLat = toRad(lat2 - lat1);
		const dLon = toRad(lon2 - lon1);
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return R * c;
	}

	function handleSpeedInput(e: Event): void {
		const target = e.target as HTMLInputElement;
		const next = parseFloat(target.value);
		roverSpeed = Number.isFinite(next) && next > 0 ? next : 0;
		updateRouteEstimates();
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
	<div class="controls">
		<div style="position:relative;">
			<input
				type="text"
				bind:value={startAddress}
				placeholder="Enter start location"
				class="input-field"
				on:input={handleStartInput}
				on:focus={() => {
					if (startSuggestions.length > 0) showStartSuggestions = true;
				}}
				on:blur={() => {
					// Delay hiding suggestions to allow click to register
					setTimeout(() => (showStartSuggestions = false), 200);
				}}
			/>
			{#if showStartSuggestions && startSuggestions.length > 0}
				<div class="suggestions">
					{#each startSuggestions as suggestion}
						<div
							class="suggestion-item"
							on:mousedown|preventDefault={() => selectStartSuggestion(suggestion)}
						>
							{formatSuggestion(suggestion)}
						</div>
					{/each}
				</div>
			{/if}
		</div>
		<div style="position:relative;">
			<input
				type="text"
				bind:value={endAddress}
				placeholder="Enter destination"
				class="input-field"
				on:input={handleEndInput}
				on:focus={() => {
					if (endSuggestions.length > 0) showEndSuggestions = true;
				}}
				on:blur={() => {
					// Delay hiding suggestions to allow click to register
					setTimeout(() => (showEndSuggestions = false), 200);
				}}
			/>
			{#if showEndSuggestions && endSuggestions.length > 0}
				<div class="suggestions">
					{#each endSuggestions as suggestion}
						<div
							class="suggestion-item"
							on:mousedown|preventDefault={() => selectEndSuggestion(suggestion)}
						>
							{formatSuggestion(suggestion)}
						</div>
					{/each}
				</div>
			{/if}
		</div>
		<div class="speed-input">
			<label for="rover-speed">Rover speed (m/s)</label>
			<input
				id="rover-speed"
				type="number"
				min="0.1"
				step="0.1"
				value={roverSpeed}
				on:input={handleSpeedInput}
				on:blur={() => {
					if (!roverSpeed || roverSpeed <= 0) {
						roverSpeed = 0.1;
						updateRouteEstimates();
					}
				}}
			/>
		</div>
		<button class="set-route-btn" on:click={setRoute}>Set Route</button>
		{#if routeSelected}
			<button class="launch-btn" on:click={launchRover}>Launch Rover</button>
		{/if}
		{#if routeSelected && routeDistanceMeters > 0}
			<div class="route-details">
				<p>
					Estimated travel time: {durationBreakdown.hours}h {durationBreakdown.minutes}m {durationBreakdown.seconds}s
				</p>
				<p>Planned distance: {routeDistanceMeters.toFixed(0)} m</p>
				{#if estimatedTravelSeconds > MAX_OPERATION_SECONDS}
					<p class="warning">⚠️ Route exceeds 1 hour. Consider adjusting the plan or recharging.</p>
				{/if}
			</div>
		{/if}
	</div>

	<div id="map" class="map-container"></div>

	<!-- Fixed back button bottom-left -->
	<div class="bottom-left">
		<a href="/rovers" class="back-button">← Rovers</a>
	</div>
</div>

<!-- ``` We need to add dynamic map subpage for each rover id, modify main page to link to it, and make map
use rover id when launching — the created file copy already does that (done). Now implement the launch-rover
page to read sessionStorage key and display waypoints and a Launch confirm button that POSTs to /api/launch/:id
(stub) and shows result. We also should remove the `window.prompt` from the original map page launchRover
if still present. The new dynamic page uses roverId so that's done. Create `src/routes/launch-rover/[id]/+page.svelte`
and an API route `src/routes/api/launch/[id].ts` that accepts POST and returns success (stub). -->

<style>
	.suggestions {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: white;
		border: 1px solid #cbd5e1;
		border-radius: 0.5rem;
		box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.1);
		z-index: 1000;
		max-height: 200px;
		overflow-y: auto;
	}

	.suggestion-item {
		padding: 12px;
		cursor: pointer;
		border-bottom: 1px solid #e2e8f0;
		color: #1e40af;
		transition: background-color 0.2s;
	}

	.suggestion-item:hover {
		background-color: #dbeafe;
	}

	.suggestion-item:last-child {
		border-bottom: none;
	}

	#map,
	.map-container {
		height: 900px;
		border-radius: 1rem;
		border: 2px solid #dbeafe;
		overflow: hidden;
	}

	.controls {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		align-items: flex-end;
		margin-bottom: 16px;
		padding: 20px;
		background: white;
		border-radius: 1rem;
		border: 1px solid #dbeafe;
		box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.1);
	}

	.input-field {
		padding: 12px 16px;
		border: 2px solid #cbd5e1;
		border-radius: 0.5rem;
		width: 250px;
		font-size: 14px;
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
		background: white;
	}

	.input-field:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.set-route-btn {
		padding: 12px 20px;
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.set-route-btn:hover {
		background: #2563eb;
	}

	.launch-btn {
		padding: 12px 20px;
		background: #dc2626;
		color: white;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.launch-btn:hover {
		background: #b91c1c;
	}

	.speed-input {
		display: flex;
		flex-direction: column;
		gap: 4px;
		color: #1e3a8a;
		font-size: 14px;
	}

	.speed-input input {
		padding: 12px 16px;
		border: 2px solid #cbd5e1;
		border-radius: 0.5rem;
		width: 150px;
		font-size: 14px;
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
		background: white;
	}

	.speed-input input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.route-details {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px 16px;
		background: #eff6ff;
		border-radius: 0.75rem;
		border: 1px solid #bfdbfe;
		color: #1e3a8a;
		font-size: 14px;
	}

	.warning {
		color: #b91c1c;
		font-weight: 600;
	}

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
