<script lang="ts">
	import { goto } from '$app/navigation';

	export let data: { paths: Array<any> };

	interface PathRow {
		id: number;
		rover_id: number;
		timestamp: Date;
		start: [number, number];
		end: [number, number];
		route: any;
	}

	function viewDetails(id: number) {
		goto(`/paths/${id}`);
	}

	function formatTimestamp(timestamp: Date | string | null | undefined) {
		if (!timestamp) return 'N/A';
		if (timestamp instanceof Date) {
			if (Number.isNaN(timestamp.getTime())) return 'N/A';
			return timestamp.toISOString().replace('T', ' ').slice(0, 19);
		}
		const normalized = timestamp.replace('T', ' ');
		return normalized.length >= 19 ? normalized.slice(0, 19) : normalized;
	}
</script>

<main class="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 p-8">
	<div class="container mx-auto max-w-6xl">
		<div class="mb-6 rounded-2xl border border-green-100 bg-white p-6 shadow-lg">
			<h1 class="mb-6 text-3xl font-bold text-green-900">Path History</h1>
			{#if !data.paths || data.paths.length === 0}
				<div class="rounded-lg border border-green-200 bg-green-50 p-8 text-center">
					<p class="text-lg text-green-700">No paths found.</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					{#each data.paths as p}
						<div
							class="cursor-pointer overflow-hidden rounded-xl border border-green-200 bg-white shadow-md transition-all duration-300 hover:scale-105 hover:shadow-lg"
							role="button"
							tabindex="0"
							on:click={() => viewDetails(p.id)}
							on:keydown={(e) => e.key === 'Enter' && viewDetails(p.id)}
						>
							<div class="p-4">
								<div class="mb-2">
									<span class="font-semibold text-green-600">Path ID:</span>
									<span class="ml-1 text-green-900">{p.id}</span>
								</div>
								<div class="mb-2">
									<span class="font-semibold text-green-600">Rover ID:</span>
									<span class="ml-1 text-green-900">{p.rover_id}</span>
								</div>
								<div class="mb-2">
									<span class="font-semibold text-green-600">Start:</span>
									<span class="ml-1 font-mono text-sm text-green-900">{p.route.coordinates[0][1]}, {p.route.coordinates[0][0]}</span>
								</div>
								<div class="mb-2">
									<span class="font-semibold text-green-600">End:</span>
									{#if p.route.coordinates.length > 0}
										<span class="ml-1 font-mono text-sm text-green-900">{p.route.coordinates[p.route.coordinates.length - 1][1]}, {p.route.coordinates[p.route.coordinates.length - 1][0]}</span>
									{:else}
										<span class="ml-1 font-mono text-sm text-green-900">N/A</span>
									{/if}
								</div>
								<div>
									<span class="font-semibold text-green-600">Timestamp:</span>
									<span class="ml-1 text-sm text-green-900">{formatTimestamp(p.timestamp)}</span>
								</div>
								<div class="mt-4">
									<div class="inline-block rounded-full bg-green-500 px-3 py-1 text-sm font-medium text-white">View Details →</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</main>
