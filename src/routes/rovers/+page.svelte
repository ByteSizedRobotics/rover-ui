<script lang="ts">
	import type { PageServerData } from './$types';
	
	let { data }: { data: PageServerData } = $props();
	
	// State management
	let filter = $state('all');
	let searchQuery = $state('');
	let filteredRovers = $state(data.roversData);
	
	// Simulate health and heartbeat data for enhanced UI
	// In a real app, this would come from the database or real-time monitoring
	function getSimulatedHealth(rover: any) {
		// Simple hash-based simulation for consistent results
		const hash = rover.id.toString().split('').reduce((a, b) => a + b.charCodeAt(0), 0);
		const healthOptions = ['ok', 'warn', 'bad'];
		return healthOptions[hash % 3];
	}
	
	function getSimulatedHeartbeat(rover: any) {
		// Simulate heartbeat based on status and rover id
		if (rover.status === 'active') {
			const hash = rover.id.toString().split('').reduce((a, b) => a + b.charCodeAt(0), 0);
			return hash % 5 + 1; // 1-5 minutes ago for active rovers
		} else {
			const hash = rover.id.toString().split('').reduce((a, b) => a + b.charCodeAt(0), 0);
			return (hash % 120) + 30; // 30-150 minutes ago for inactive rovers
		}
	}
	
	function formatHeartbeat(mins: number) {
		if (mins < 1) return "just now";
		if (mins === 1) return "1 min ago";
		if (mins < 60) return `${mins} mins ago`;
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		return `${h}h ${m}m ago`;
	}
	
	// Computed counts
	$effect(() => {
		let filtered = data.roversData;
		
		// Apply status filter
		if (filter !== 'all') {
			filtered = filtered.filter(rover => rover.status === filter);
		}
		
		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(rover => 
				rover.name.toLowerCase().includes(query) || 
				rover.id.toString().includes(query)
			);
		}
		
		filteredRovers = filtered;
	});
	
	const activeCounts = $derived(data.roversData.filter(r => r.status === 'active').length);
	const inactiveCounts = $derived(data.roversData.filter(r => r.status === 'inactive').length);
</script>

<div class="min-h-screen bg-base-100">
	<div class="container mx-auto p-6 max-w-7xl">
		<!-- Header -->
		<header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
			<div class="flex items-center gap-4">
				<div>
					<h1 class="text-3xl font-bold text-base-content">Rover Switchboard</h1>
					<div class="text-sm text-base-content/70">
						Active: <span class="font-semibold text-success">{activeCounts}</span> • 
						Inactive: <span class="font-semibold text-error">{inactiveCounts}</span> • 
						All: <span class="font-semibold">{data.roversData.length}</span>
					</div>
				</div>
			</div>
			
			<!-- Toolbar -->
			<div class="flex flex-col sm:flex-row gap-3">
				<!-- Filter buttons -->
				<div class="join">
					<button 
						class="btn join-item {filter === 'all' ? 'btn-primary' : 'btn-outline'}"
						onclick={() => filter = 'all'}
					>
						All
					</button>
					<button 
						class="btn join-item {filter === 'active' ? 'btn-primary' : 'btn-outline'}"
						onclick={() => filter = 'active'}
					>
						Active
					</button>
					<button 
						class="btn join-item {filter === 'inactive' ? 'btn-primary' : 'btn-outline'}"
						onclick={() => filter = 'inactive'}
					>
						Inactive
					</button>
				</div>				<!-- Search -->
				<div class="relative">
					<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<svg class="h-5 w-5 text-base-content/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>
					</div>
					<input 
						id="search-input"
						type="search" 
						placeholder="Search rovers..." 
						class="input input-bordered pl-10 w-full sm:w-64"
						bind:value={searchQuery}
					/>
				</div>
			</div>
		</header>

		<!-- Rovers Grid -->
		<main class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each filteredRovers as rover (rover.id)}
				{@const health = getSimulatedHealth(rover)}
				{@const heartbeatMins = getSimulatedHeartbeat(rover)}
				
				<article 
					class="card bg-base-200 shadow-xl hover:shadow-2xl transition-all duration-200 hover:-translate-y-1 border border-base-300"
					role="group"
					aria-label="{rover.name} {rover.id}"
				>
					<!-- Image -->
					<figure class="relative">
						<div class="aspect-video bg-base-300 overflow-hidden">
							{#if rover.status === 'active'}
								<img src="./LiveMetrics.png" alt={rover.name} class="w-full h-full object-cover" />
							{:else}
								<img src="./PathPlan.png" alt={rover.name} class="w-full h-full object-cover" />
							{/if}
						</div>
						
						<!-- Status badge -->
						<div class="absolute top-3 left-3">
							<div class="badge badge-lg gap-2 bg-black/50 border-base-content/20 text-white backdrop-blur-sm">
								<div class="w-2 h-2 rounded-full {rover.status === 'active' ? 'bg-success' : health === 'warn' ? 'bg-warning' : 'bg-error'}"></div>
								{rover.status.toUpperCase()}
							</div>
						</div>
					</figure>
					
					<!-- Card Body -->
					<div class="card-body">
						<div class="flex items-start justify-between gap-3 mb-3">
							<div class="flex items-center gap-3 flex-1 min-w-0">
								<div class="badge badge-outline text-xs font-mono">Rover-{rover.id}</div>
								<h2 class="card-title text-lg truncate">{rover.name}</h2>
							</div>
							<div class="text-xs text-base-content/60 whitespace-nowrap">
								⏱ {formatHeartbeat(heartbeatMins)}
							</div>
						</div>
						
						<!-- Actions -->
						<div class="card-actions gap-2 mt-auto">
							{#if rover.status === 'active'}
								<a href="/rovers/{rover.id}" class="btn btn-primary flex-1">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
									</svg>
									Live Metrics
								</a>
								<a href="/map/{rover.id}" class="btn btn-outline flex-1">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
									</svg>
									Plan Path
								</a>
							{:else}
								<a href="/map/{rover.id}" class="btn btn-primary flex-1">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
									</svg>
									Plan Path
								</a>
								<a href="/rovers/{rover.id}" class="btn btn-outline flex-1">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
									</svg>
									View Metrics
								</a>
							{/if}
						</div>
					</div>
				</article>
			{/each}
		</main>

		<!-- Empty state -->
		{#if filteredRovers.length === 0}
			<div class="text-center py-16">
				<div class="bg-base-200 border-2 border-dashed border-base-300 rounded-2xl p-8 max-w-md mx-auto">
					<svg class="w-16 h-16 text-base-content/30 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					<h3 class="text-lg font-semibold text-base-content/70 mb-2">No rovers match your filters</h3>
					<p class="text-base-content/50">Try adjusting your search or filter criteria.</p>
				</div>
			</div>
		{/if}
	</div>
</div>
