<script>
  import { onMount } from 'svelte';

  let map;
  let geocoder;
  let routingControl;
  let startAddress = '';
  let endAddress = '';

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

  async function setRoute() {
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

        // Check if route is actually drawn
        console.log("Waypoints set:", routingControl.getWaypoints());
      }
    } catch (error) {
      alert("Error finding locations. Please check your addresses.");
      console.error(error);
    }
  }

  async function geocodeAddress(address) {
  console.log(`Geocoding address: ${address}`);

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;

  const response = await fetch(url);
  const results = await response.json();

  console.log(`Geocode results for "${address}":`, results);

  if (results.length > 0) {
    return {
      lat: results[0].lat,
      lng: results[0].lon
    };
  } else {
    alert(`Could not find location: ${address}`);
    throw new Error(`No results found for "${address}"`);
  }
}

</script>

<style>
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
</style>

<div class="controls">
  <input type="text" bind:value={startAddress} placeholder="Enter start location" />
  <input type="text" bind:value={endAddress} placeholder="Enter destination" />
  <button on:click={setRoute}>Set Route</button>
</div>

<div id="map"></div>
