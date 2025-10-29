<script lang="ts">
	import { goto } from '$app/navigation';

	export let data: { images: Image[] };

	interface Image {
		id: number;
		pathId: number;
		location: [number, number];
		timestamp: Date;
		imageUrl: string;
	}

	function viewDetails(id: number) {
		goto(`/potholes/${id}`);
	}
</script>

<main class="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 p-8">
	<div class="container mx-auto max-w-6xl">
		<div class="mb-6 rounded-2xl border border-purple-100 bg-white p-6 shadow-lg">
			<h1 class="mb-6 text-3xl font-bold text-purple-900">Pothole Explorer</h1>
			{#if !data.images || data.images.length === 0}
				<div class="rounded-lg border border-purple-200 bg-purple-50 p-8 text-center">
					<p class="text-lg text-purple-700">No potholes found.</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					{#each data.images as pothole}
						<div
							class="cursor-pointer overflow-hidden rounded-xl border border-purple-200 bg-white shadow-md transition-all duration-300 hover:scale-105 hover:shadow-lg"
							role="button"
							tabindex="0"
							on:click={() => viewDetails(pothole.id)}
							on:keydown={(e) => e.key === 'Enter' && viewDetails(pothole.id)}
						>
							<div class="aspect-video overflow-hidden">
								<img
									src={pothole.imageUrl}
									alt={`Pothole ${pothole.id}`}
									class="h-full w-full object-cover"
								/>
							</div>
							<div class="p-4">
								<div class="mb-2">
									<span class="font-semibold text-purple-600">ID:</span>
									<span class="ml-1 text-purple-900">{pothole.id}</span>
								</div>
								<div class="mb-2">
									<span class="font-semibold text-purple-600">Path ID:</span>
									<span class="ml-1 text-purple-900">{pothole.pathId}</span>
								</div>
								<div class="mb-2">
									<span class="font-semibold text-purple-600">Location:</span>
									<span class="ml-1 font-mono text-sm text-purple-900"
										>[{pothole.location[0]}, {pothole.location[1]}]</span
									>
								</div>
								<div>
									<span class="font-semibold text-purple-600">Timestamp:</span>
									<span class="ml-1 text-sm text-purple-900">
										{pothole.timestamp ? pothole.timestamp.toString() : 'N/A'}
									</span>
								</div>
								<div class="mt-4">
									<div
										class="inline-block rounded-full bg-purple-500 px-3 py-1 text-sm font-medium text-white"
									>
										View Details →
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</main>
