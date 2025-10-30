<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	export let data: { path: any };

	let coords: { lat: number; lng: number }[] = [];

	onMount(() => {
		const route = data.path.route;
		if (route && route.coordinates && Array.isArray(route.coordinates)) {
			coords = route.coordinates.map((c: any) => ({ lat: c[1], lng: c[0] }));
		}
	});

	function goBack() {
		history.back();
	}
</script>

<main class="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 p-8">
	<div class="container mx-auto max-w-6xl">
		<div class="mb-6 rounded-2xl border border-green-100 bg-white p-6 shadow-lg">
			<button on:click={goBack} class="mb-4 text-sm text-green-600">← Back</button>
			<h1 class="mb-4 text-2xl font-bold text-green-900">Path #{data.path.id}</h1>
			<div class="mb-4">
				<strong>Rover ID:</strong> {data.path.rover_id}
			</div>
			<div class="mb-4">
				<strong>Timestamp:</strong> {data.path.timestamp ? new Date(data.path.timestamp).toString() : 'N/A'}
			</div>

			{#if coords.length > 0}
				<div class="mb-4">
					<strong>Coordinates:</strong>
					<ul class="list-disc ml-6 mt-2">
						{#each coords as c}
							<li class="font-mono text-sm text-green-900">{c.lat}, {c.lng}</li>
						{/each}
					</ul>
				</div>
			{:else}
				<div class="rounded-lg border border-green-200 bg-green-50 p-4">No route coordinates available.</div>
			{/if}
		</div>
	</div>
</main>
