<script lang="ts">
	import type { PageServerData } from './$types';
	import { getRoverStatus, minutesFromNow } from '$lib/utils';

	let { data }: { data: PageServerData } = $props();

	// State management
	let filter = $state('all');
	let searchQuery = $state('');
	let filteredRovers = $state(data.roversData);

	// TODO: remove this
	// Simulate health and heartbeat data for enhanced UI
	// In a real app, this would come from the database or real-time monitoring
	function getSimulatedHealth(rover: any) {
		// Simple hash-based simulation for consistent results
		const hash = rover.id
			.toString()
			.split('')
			.reduce((a: number, b: string) => a + b.charCodeAt(0), 0);
		const healthOptions = ['ok', 'warn', 'bad'];
		return healthOptions[hash % 3];
	}

	function getSimulatedHeartbeat(rover: any) {
		// Simulate heartbeat based on status and rover id
		if (rover.status === 'active') {
			const hash = rover.id
				.toString()
				.split('')
				.reduce((a: number, b: string) => a + b.charCodeAt(0), 0);
			return (hash % 5) + 1; // 1-5 minutes ago for active rovers
		} else {
			const hash = rover.id
				.toString()
				.split('')
				.reduce((a: number, b: string) => a + b.charCodeAt(0), 0);
			return (hash % 120) + 30; // 30-150 minutes ago for inactive rovers
		}
	}

	function formatHeartbeat(mins: number) {
		if (mins < 1) return 'just now';
		if (mins === 1) return '1 min ago';
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
			filtered = filtered.filter((rover) => getRoverStatus(rover) === filter);
		}

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(rover) => rover.name.toLowerCase().includes(query) || rover.id.toString().includes(query)
			);
		}

		filteredRovers = filtered;
	});

	const activeCounts = $derived(
		data.roversData.filter((r) => getRoverStatus(r) === 'active').length
	);
	const inactiveCounts = $derived(
		data.roversData.filter((r) => getRoverStatus(r) === 'inactive').length
	);
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
	<div class="container mx-auto max-w-7xl p-6">
		<!-- Header -->
		<header
			class="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center"
		>
			<div class="flex items-center gap-4">
				<div>
					<h1 class="text-3xl font-bold text-blue-900">Rover Switchboard</h1>
					<div class="text-sm text-blue-600">
						Active: <span class="font-semibold text-green-600">{activeCounts}</span> • Inactive:
						<span class="font-semibold text-red-600">{inactiveCounts}</span>
						• All: <span class="font-semibold text-blue-700">{data.roversData.length}</span>
					</div>
				</div>
			</div>

			<!-- Toolbar -->
			<div class="flex flex-col gap-3 sm:flex-row">
				<!-- Filter buttons -->
				<div class="flex overflow-hidden rounded-lg border border-blue-200">
					<button
						class="px-4 py-2 text-sm font-medium transition-colors {filter === 'all'
							? 'bg-blue-500 text-white'
							: 'bg-white text-blue-600 hover:bg-blue-50'}"
						onclick={() => (filter = 'all')}
					>
						All
					</button>
					<button
						class="border-l border-blue-200 px-4 py-2 text-sm font-medium transition-colors {filter ===
						'active'
							? 'bg-blue-500 text-white'
							: 'bg-white text-blue-600 hover:bg-blue-50'}"
						onclick={() => (filter = 'active')}
					>
						Active
					</button>
					<button
						class="border-l border-blue-200 px-4 py-2 text-sm font-medium transition-colors {filter ===
						'inactive'
							? 'bg-blue-500 text-white'
							: 'bg-white text-blue-600 hover:bg-blue-50'}"
						onclick={() => (filter = 'inactive')}
					>
						Inactive
					</button>
				</div>
				<!-- Search -->
				<div class="relative">
					<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
						<svg
							class="h-5 w-5 text-blue-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
					</div>
					<input
						id="search-input"
						type="search"
						placeholder="Search rovers..."
						class="w-full rounded-lg border border-blue-200 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-64"
						bind:value={searchQuery}
					/>
				</div>
			</div>
		</header>

		<!-- Rovers Grid -->
		<main class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each filteredRovers as rover (rover.id)}
				<!-- {@const health = getSimulatedHealth(rover)} -->
				{@const heartbeatMins = minutesFromNow(rover.lastHeartbeat ?? new Date(0))}

				<article
					class="rounded-2xl border border-blue-100 bg-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl"
					role="group"
					aria-label="{rover.name} {rover.id}"
				>
					<!-- Image -->
					<figure class="relative">
						<div class="aspect-video overflow-hidden rounded-t-2xl bg-blue-50">
							{#if getRoverStatus(rover) === 'active'}
								<img
									src="./UE5_1.png"
									alt={rover.name}
									class="h-full w-full scale-150 object-cover"
								/>
							{:else}
								<img
									src="./MapExtended.png"
									alt={rover.name}
									class="scale-130 h-full w-full object-cover"
								/>
							{/if}
						</div>

						<!-- Status badge -->
						<div class="absolute left-3 top-3">
							<div
								class="flex items-center gap-2 rounded-full border border-blue-200/30 bg-black/50 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm"
							>
								<div
									class="h-2 w-2 rounded-full {getRoverStatus(rover) === 'active'
										? 'bg-green-400'
										: 'bg-red-400'}"
								></div>
								{getRoverStatus(rover).toUpperCase()}
							</div>
						</div>
					</figure>

					<!-- Card Body -->
					<div class="p-6">
						<div class="mb-3 flex items-start justify-between gap-3">
							<div class="flex min-w-0 flex-1 items-center gap-3">
								<div class="rounded bg-blue-100 px-2 py-1 font-mono text-xs text-blue-700">
									Rover-{rover.id}
								</div>
								<h2 class="truncate text-lg font-bold text-blue-900">{rover.name}</h2>
							</div>
							<div class="whitespace-nowrap text-xs text-blue-600">
								⏱ {formatHeartbeat(heartbeatMins)}
							</div>
						</div>

						<!-- Actions -->
						<div class="mt-auto flex gap-2">
							{#if getRoverStatus(rover) === 'active'}
								<a
									href={rover.latestPathId ? `/rovers/${rover.id}/${rover.latestPathId}` : `/map/${rover.id}`}
									class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
										/>
									</svg>
									Live Metrics
								</a>
							{:else}
								<a
									href="/map/{rover.id}"
									class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
										/>
									</svg>
									Plan Path
								</a>
							{/if}
						</div>
					</div>
				</article>
			{/each}
		</main>

		<!-- Empty state -->
		{#if filteredRovers.length === 0}
			<div class="py-16 text-center">
				<div
					class="mx-auto max-w-md rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50 p-8"
				>
					<svg
						class="mx-auto mb-4 h-16 w-16 text-blue-300"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					<h3 class="mb-2 text-lg font-semibold text-blue-700">No rovers match your filters</h3>
					<p class="text-blue-600">Try adjusting your search or filter criteria.</p>
				</div>
			</div>
		{/if}
	</div>
</div>
