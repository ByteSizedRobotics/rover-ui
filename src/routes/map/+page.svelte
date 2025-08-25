<script lang="ts">
  import { onMount } from 'svelte';

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
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
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

    console.log("Map, geocoder, and routing control initialized.");
  });

  async function setRoute(): Promise<void> {
    if (!startAddress || !endAddress) {
      alert("Please enter both a start and an end location.");
      return;
    }


    console.log(`Geocoding start: ${startAddress}`);
    console.log(`Geocoding end: ${endAddress}`);

    try {
      const startCoords = await geocodeAddress(startAddress);
      const endCoords = await geocodeAddress(endAddress);

  if (startCoords && endCoords) {
        console.log("Geocoding successful!", { startCoords, endCoords });

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
        console.log("Waypoints set:", routingControl.getWaypoints());
      }
    } catch (error) {
      alert("Error finding locations. Please check your addresses.");
      console.error(error);
    }
  }

  function launchRover(): void {
    // Placeholder: trigger rover launch. Replace with real API call when available.
    console.log('Launch Rover clicked.');
    alert('Launch command sent to rover (placeholder).');
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
    if (!query) return [];
    
    // Extract number from query if it exists (like "123 Main St")
    const numberMatch = query.match(/^\s*(\d+)\s+(.+)/);
    let houseNumber: string | null = null;
    let queryText = query;
    
    if (numberMatch) {
      houseNumber = numberMatch[1];
      queryText = numberMatch[2]; // Use the street part for search
    }
    
    // Restrict to Canada and prioritize structured addresses
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&countrycodes=ca&limit=15`;
    
    try {
      console.log("Fetching from URL:", url);
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error("Nominatim API error:", response.status, response.statusText);
        return [];
      }
      
      let results: NominatimResult[] = await response.json();
      console.log("Raw results:", results);
    
      // If user entered a house number, prioritize matches with that number
      if (houseNumber) {
        results.sort((a: NominatimResult, b: NominatimResult) => {
          const aMatch = a.address?.house_number === houseNumber ? 1 : 0;
          const bMatch = b.address?.house_number === houseNumber ? 1 : 0;
          return bMatch - aMatch;
        });
      }
      
      // Filter for unique street/road/city combinations
      const seen = new Set<string>();
      results = results.filter((r: NominatimResult) => {
        const address = r.address || {};
        
        // Accept results even without road/street for flexibility
        const road = address.road || address.street || '';
        const city = address.city || address.town || address.village || '';
        const province = address.state || address.province || '';
        
        // Include postal code in key if available for better uniqueness
        const key = `${road}|${city}|${province}`;
        
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      
      console.log("Filtered results:", results);
      
      // Limit to 5 unique results
      return results.slice(0, 5);
    } catch (error) {
      console.error("Error fetching or processing suggestions:", error);
      return [];
    }
  }

  // Add debounce to avoid too many API calls
  let startInputTimeout: ReturnType<typeof setTimeout> | null = null;
  
  async function handleStartInput(e: Event): Promise<void> {
    const target = e.target as HTMLInputElement;
    startAddress = target.value;
    
    // Clear any existing timeout
    if (startInputTimeout) clearTimeout(startInputTimeout);
    
    // Set a new timeout to delay the API call
  startInputTimeout = setTimeout(async () => {
      if (startAddress.length > 2) {
        try {
          console.log("Fetching suggestions for:", startAddress);
          startSuggestions = await fetchSuggestions(startAddress);
          console.log("Got suggestions:", startSuggestions);
          showStartSuggestions = startSuggestions.length > 0;
        } catch (error) {
          console.error("Error fetching suggestions:", error);
          startSuggestions = [];
          showStartSuggestions = false;
        }
      } else {
        startSuggestions = [];
        showStartSuggestions = false;
      }
    }, 300); // 300ms debounce
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

  // Add debounce for end input as well
  let endInputTimeout: ReturnType<typeof setTimeout> | null = null;
  
  async function handleEndInput(e: Event): Promise<void> {
    const target = e.target as HTMLInputElement;
    endAddress = target.value;
    
    // Clear any existing timeout
    if (endInputTimeout) clearTimeout(endInputTimeout);
    
    // Set a new timeout to delay the API call
    endInputTimeout = setTimeout(async () => {
      if (endAddress.length > 2) {
        try {
          console.log("Fetching suggestions for:", endAddress);
          endSuggestions = await fetchSuggestions(endAddress);
          console.log("Got suggestions:", endSuggestions);
          showEndSuggestions = endSuggestions.length > 0;
        } catch (error) {
          console.error("Error fetching suggestions:", error);
          endSuggestions = [];
          showEndSuggestions = false;
        }
      } else {
        endSuggestions = [];
        showEndSuggestions = false;
      }
    }, 300); // 300ms debounce
  }

  function selectEndSuggestion(suggestion: NominatimResult): void {
    endAddress = formatSuggestion(suggestion);
    showEndSuggestions = false;
    endSuggestions = [];
  }

</script>

<style>
  .suggestions {
    position: absolute;
    background: white;
    border: 1px solid #ccc;
    border-radius: 5px;
    width: 200px;
    max-height: 180px;
    overflow-y: auto;
    z-index: 1001;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  .suggestion-item {
    padding: 8px;
    cursor: pointer;
  }
  #map {
    height: 900px;
  }

  .controls {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
  }

  

  input {
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 5px;
    width: 200px;
  }

  button {
    padding: 8px 12px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
  }

  button:hover {
    background: #0056b3;
  }

  /* Launch button (red) */
  .launch {
    background: #dc2626; /* red-600 */
  }
  .launch:hover {
    background: #b91c1c; /* red-700 */
  }

  /* Fixed back button in bottom-left */
  .bottom-left {
    position: fixed;
    left: 16px;
    bottom: 16px;
    z-index: 1002;
  }
</style>

<div class="controls">
  <div style="position:relative;">
    <input 
      type="text" 
      bind:value={startAddress} 
      placeholder="Enter start location" 
      on:input={handleStartInput} 
      on:focus={() => {
        if (startSuggestions.length > 0) showStartSuggestions = true;
      }} 
      on:blur={() => {
        // Delay hiding suggestions to allow click to register
        setTimeout(() => showStartSuggestions = false, 200);
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
      on:input={handleEndInput} 
      on:focus={() => {
        if (endSuggestions.length > 0) showEndSuggestions = true;
      }} 
      on:blur={() => {
        // Delay hiding suggestions to allow click to register
        setTimeout(() => showEndSuggestions = false, 200);
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
  <button on:click={setRoute}>Set Route</button>
  {#if routeSelected}
    <button class="launch" on:click={launchRover}>Launch Rover</button>
  {/if}
</div>

<div id="map"></div>

<!-- Fixed back button bottom-left -->
<div class="bottom-left">
  <button on:click={() => history.back()}>Back</button>
</div>
