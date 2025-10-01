<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import { filterSuggestions, formatSuggestionLabel } from '$lib/locationSuggestions';
	import type { NominatimAddress, NominatimResult } from '$lib/locationSuggestions';

	const params = get(page).params;
	const roverId = params.id;

	let map: L.Map;
	let geocoder: any;
	let routingControl: L.Routing.Control;
	let startAddress = '';
	let endAddress = '';
	let startSuggestions: NominatimResult[] = [];
	let endSuggestions: NominatimResult[] = [];
	let showStartSuggestions = false;
	let showEndSuggestions = false;
	let routeSelected = false;
	let lastRoutes: any[] = [];
	let userLocation: GeoLocation | null = null;
	let currentCity = '';
	let currentProvince = '';
	let searchBounds: BoundingBox | null = null;
	const suggestionCache = new Map<string, NominatimResult[]>();
	let suggestionsController: AbortController | null = null;
	let selectedStartCoords: GeoLocation | null = null;
	let selectedEndCoords: GeoLocation | null = null;
	let lastStartFetch = 0;
	let lastEndFetch = 0;
	let latestStartQuery = '';
	let latestEndQuery = '';
	const MIN_FETCH_INTERVAL = 150; // Minimum ms between API calls

	// Debug reactive statement
	$: {
		console.log('=== REACTIVE DEBUG ===');
		console.log('startSuggestions:', startSuggestions);
		console.log('startSuggestions.length:', startSuggestions.length);
		console.log('showStartSuggestions:', showStartSuggestions);
		console.log('===================');
	}

	interface GeoLocation {
		lat: number;
		lng: number;
	}

	interface BoundingBox {
		left: number;
		right: number;
		top: number;
		bottom: number;
	}

	onMount(async () => {
		const leafletModule = await import('leaflet');
		const L = leafletModule.default;

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
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
			subdomains: 'abcd',
			maxZoom: 20
		}).addTo(map);

		// Import additional Leaflet components in parallel
		await Promise.all([import('leaflet-routing-machine'), import('leaflet-control-geocoder')]);

		// Properly instantiate Nominatim geocoder
		geocoder = new L.Control.Geocoder.Nominatim();

		// Initialize routing control (empty waypoints initially)
		routingControl = L.Routing.control({
			waypoints: [],
			routeWhileDragging: true
		}).addTo(map);

		await initializeGeolocation();

		// store routes when found so we can extract full geometry later
		routingControl.on('routesfound', (e: any) => {
			lastRoutes = e.routes || [];
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
			const startCoords =
				selectedStartCoords ?? (await geocodeAddress(startAddress));
			const endCoords = selectedEndCoords ?? (await geocodeAddress(endAddress));

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
		const payload = { waypoints, start: startAddress, end: endAddress };
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
		const { params } = buildSearchParams(address, 5);
		const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
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
		if (!query) return [];

		// Extract number from query if it exists (like "123 Main St")
		const normalizedQuery = query.trim().toLowerCase();
		const cacheKey = `${normalizedQuery}|${currentCity}|${currentProvince}`;

		if (suggestionCache.has(cacheKey)) {
			return suggestionCache.get(cacheKey) ?? [];
		}

		const { params, houseNumber } = buildSearchParams(query, 5);
		params.set('dedupe', '1');
		params.set('limit', '5');

		try {
			if (suggestionsController) {
				suggestionsController.abort();
			}
			suggestionsController = new AbortController();

			const response = await fetch(
				`https://nominatim.openstreetmap.org/search?${params.toString()}`,
				{ signal: suggestionsController.signal }
			);

			if (!response.ok) {
				console.error('Nominatim API error:', response.status, response.statusText);
				return [];
			}

			let results: NominatimResult[] = await response.json();
			console.log('Raw results:', results);
			console.log('Number of raw results:', results.length);

			let filtered = filterSuggestions(results, { houseNumber, limit: 5 });
			if (filtered.length === 0 && results.length > 0) {
				console.log('Filter removed all results, falling back to raw slice.');
				filtered = results.slice(0, 5);
			}

			console.log('Filtered results:', filtered);
			console.log('Number of filtered results:', filtered.length);

			suggestionCache.set(cacheKey, filtered);
			return filtered;
		} catch (error) {
			if ((error as Error).name === 'AbortError') {
				return [];
			}
			console.error('Error fetching or processing suggestions:', error);
			return [];
		} finally {
			suggestionsController = null;
		}
	}

	// Immediate fetch with rate limiting
	let startInputTimeout: ReturnType<typeof setTimeout> | null = null;

	async function handleStartInput(e: Event): Promise<void> {
		console.log('>>> handleStartInput called');
		const target = e.target as HTMLInputElement;
		startAddress = target.value;
		console.log('>>> Input value:', startAddress);
		selectedStartCoords = null;
		const normalizedQuery = startAddress.trim().toLowerCase();
		latestStartQuery = normalizedQuery;

		if (startAddress.length < 1) {
			startSuggestions = [];
			showStartSuggestions = false;
			console.log('>>> Input too short, clearing suggestions');
			return;
		}

		// Check cache immediately for instant results
		const cacheKey = `${normalizedQuery}|${currentCity}|${currentProvince}`;
		if (suggestionCache.has(cacheKey)) {
			startSuggestions = [...(suggestionCache.get(cacheKey) ?? [])];
			showStartSuggestions = startSuggestions.length > 0;
			console.log('>>> Using cached suggestions:', startSuggestions.length);
			return;
		}

		// Rate limiting: ensure minimum interval between requests
		const now = Date.now();
		const timeSinceLastFetch = now - lastStartFetch;
		
		if (startInputTimeout) clearTimeout(startInputTimeout);
		
		if (timeSinceLastFetch < MIN_FETCH_INTERVAL) {
			// Schedule fetch after minimum interval
			startInputTimeout = setTimeout(() => handleStartInput(e), MIN_FETCH_INTERVAL - timeSinceLastFetch);
			return;
		}

		// Fetch immediately
		lastStartFetch = now;
		try {
			console.log('Fetching suggestions for:', startAddress);
			const previousSuggestions = startSuggestions;
			const fetchedSuggestions = await fetchSuggestions(startAddress);
			console.log('Got suggestions:', fetchedSuggestions);
			console.log('Number of suggestions:', fetchedSuggestions.length);
			if (latestStartQuery !== normalizedQuery) {
				console.log('Discarding outdated start suggestions for query:', normalizedQuery);
				return;
			}
			if (fetchedSuggestions.length === 0 && previousSuggestions.length > 0) {
				console.log('Keeping previous start suggestions (empty response).');
				startSuggestions = [...previousSuggestions];
				showStartSuggestions = true;
				return;
			}
			startSuggestions = [...fetchedSuggestions];
			showStartSuggestions = startSuggestions.length > 0;
			console.log('showStartSuggestions is now:', showStartSuggestions);
		} catch (error) {
			console.error('Error fetching suggestions:', error);
			startSuggestions = [];
			showStartSuggestions = false;
		}
	}

	function selectStartSuggestion(suggestion: NominatimResult): void {
		startAddress = formatSuggestionLabel(suggestion);
		latestStartQuery = startAddress.trim().toLowerCase();
		showStartSuggestions = false;
		startSuggestions = [];
		selectedStartCoords = {
			lat: parseFloat(suggestion.lat),
			lng: parseFloat(suggestion.lon)
		};
	}

	// Immediate fetch with rate limiting
	let endInputTimeout: ReturnType<typeof setTimeout> | null = null;

	async function handleEndInput(e: Event): Promise<void> {
		const target = e.target as HTMLInputElement;
		endAddress = target.value;
		selectedEndCoords = null;
		const normalizedQuery = endAddress.trim().toLowerCase();
		latestEndQuery = normalizedQuery;

		if (endAddress.length < 1) {
			endSuggestions = [];
			showEndSuggestions = false;
			return;
		}

		// Check cache immediately for instant results
		const cacheKey = `${normalizedQuery}|${currentCity}|${currentProvince}`;
		if (suggestionCache.has(cacheKey)) {
			endSuggestions = [...(suggestionCache.get(cacheKey) ?? [])];
			showEndSuggestions = endSuggestions.length > 0;
			return;
		}

		// Rate limiting: ensure minimum interval between requests
		const now = Date.now();
		const timeSinceLastFetch = now - lastEndFetch;
		
		if (endInputTimeout) clearTimeout(endInputTimeout);
		
		if (timeSinceLastFetch < MIN_FETCH_INTERVAL) {
			// Schedule fetch after minimum interval
			endInputTimeout = setTimeout(() => handleEndInput(e), MIN_FETCH_INTERVAL - timeSinceLastFetch);
			return;
		}

		// Fetch immediately
		lastEndFetch = now;
		try {
			console.log('Fetching suggestions for:', endAddress);
			const previousSuggestions = endSuggestions;
			const fetchedSuggestions = await fetchSuggestions(endAddress);
			console.log('Got suggestions:', fetchedSuggestions);
			if (latestEndQuery !== normalizedQuery) {
				console.log('Discarding outdated end suggestions for query:', normalizedQuery);
				return;
			}
			if (fetchedSuggestions.length === 0 && previousSuggestions.length > 0) {
				console.log('Keeping previous end suggestions (empty response).');
				endSuggestions = [...previousSuggestions];
				showEndSuggestions = true;
				return;
			}
			endSuggestions = [...fetchedSuggestions];
			showEndSuggestions = endSuggestions.length > 0;
		} catch (error) {
			console.error('Error fetching suggestions:', error);
			endSuggestions = [];
			showEndSuggestions = false;
		}
	}

	function selectEndSuggestion(suggestion: NominatimResult): void {
		endAddress = formatSuggestionLabel(suggestion);
		latestEndQuery = endAddress.trim().toLowerCase();
		showEndSuggestions = false;
		endSuggestions = [];
		selectedEndCoords = {
			lat: parseFloat(suggestion.lat),
			lng: parseFloat(suggestion.lon)
		};
	}

	function parseAddressQuery(query: string): { houseNumber: string | null; street: string } {
		const trimmed = query.trim();
		const numberMatch = trimmed.match(/^(\d+)\s+(.*)$/);
		if (numberMatch) {
			return {
				houseNumber: numberMatch[1],
				street: numberMatch[2]
			};
		}
		return { houseNumber: null, street: trimmed };
	}

	function buildSearchParams(query: string, limit = 10): {
		params: URLSearchParams;
		houseNumber: string | null;
	} {
		const { houseNumber, street } = parseAddressQuery(query);
		const params = new URLSearchParams({
			format: 'jsonv2',
			addressdetails: '1',
			limit: String(limit),
			countrycodes: 'ca'
		});
		if (houseNumber || street) {
			const streetParam = [houseNumber, street].filter(Boolean).join(' ').trim();
			if (streetParam) params.set('street', streetParam);
		}
		if (!params.has('street') || !params.get('street')) {
			params.set('q', query);
		}
		if (currentCity) params.set('city', currentCity);
		if (currentProvince) params.set('state', currentProvince);
		if (searchBounds) {
			params.set(
				'viewbox',
				`${searchBounds.left},${searchBounds.top},${searchBounds.right},${searchBounds.bottom}`
			);
			params.set('bounded', '1');
		}
		return { params, houseNumber };
	}

	async function initializeGeolocation(): Promise<void> {
		if (typeof navigator === 'undefined' || !navigator.geolocation) {
			return;
		}

		return new Promise((resolve) => {
			navigator.geolocation.getCurrentPosition(
				async (position) => {
					const { latitude, longitude } = position.coords;
					userLocation = { lat: latitude, lng: longitude };
					searchBounds = computeBoundingBox(userLocation, 5);
					map.setView([latitude, longitude], 14);

					try {
						const { city, province } = await reverseGeocode(latitude, longitude);
						currentCity = city;
						currentProvince = province;
					} catch (err) {
						console.warn('Reverse geocode failed', err);
					}

					resolve();
				},
				(error) => {
					console.warn('Geolocation unavailable', error);
					searchBounds = null;
					resolve();
				},
				{ enableHighAccuracy: true, timeout: 5000 }
			);
		});
	}

	function computeBoundingBox(location: GeoLocation, radiusKm = 5): BoundingBox {
		const earthRadiusKm = 6371;
		const deltaLat = (radiusKm / earthRadiusKm) * (180 / Math.PI);
		const deltaLng = deltaLat / Math.cos((location.lat * Math.PI) / 180);
		return {
			left: location.lng - deltaLng,
			right: location.lng + deltaLng,
			top: location.lat + deltaLat,
			bottom: location.lat - deltaLat
		};
	}

	async function reverseGeocode(lat: number, lon: number): Promise<{
		city: string;
		province: string;
	}> {
		const params = new URLSearchParams({
			format: 'jsonv2',
			lat: String(lat),
			lon: String(lon),
			addressdetails: '1'
		});
		const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`);
		if (!response.ok) {
			throw new Error('Reverse geocode failed');
		}
		const data = await response.json();
		const address: NominatimAddress = data.address || {};
		return {
			city: address.city || address.town || address.village || '',
			province: address.state || address.province || ''
		};
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
				<div class="suggestions" role="list">
					{#each startSuggestions as suggestion}
						<div
							class="suggestion-item"
							role="button"
							tabindex="0"
							on:mousedown|preventDefault={() => selectStartSuggestion(suggestion)}
							on:keydown={(e) => e.key === 'Enter' && selectStartSuggestion(suggestion)}
						>
							{formatSuggestionLabel(suggestion)}
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
			<div class="suggestions" role="list">
				{#each endSuggestions as suggestion}
					<div
							class="suggestion-item"
							role="button"
							tabindex="0"
							on:mousedown|preventDefault={() => selectEndSuggestion(suggestion)}
							on:keydown={(e) => e.key === 'Enter' && selectEndSuggestion(suggestion)}
						>
							{formatSuggestionLabel(suggestion)}
						</div>
				{/each}
			</div>
		{/if}
	</div>
	<button class="set-route-btn" on:click={setRoute}>Set Route</button>
	{#if routeSelected}
		<button class="launch-btn" on:click={launchRover}>Launch Rover</button>
	{/if}
</div>

<div id="map" class="map-container"></div>

<!-- Fixed back button bottom-left -->
<div class="bottom-left">
	<a href="/" class="back-button">← Home</a>
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
		transition: border-color 0.2s, box-shadow 0.2s;
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
