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
		<div class="bg-white rounded-2xl shadow-lg border border-purple-100 p-6 mb-6">
			<h1 class="mb-6 text-3xl font-bold text-purple-900">Pothole Explorer</h1>
			{#if !data.images || data.images.length === 0}
				<div class="bg-purple-50 border border-purple-200 rounded-lg p-8 text-center">
					<p class="text-purple-700 text-lg">No potholes found.</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{#each data.images as pothole}
						<div
							class="bg-white border border-purple-200 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 overflow-hidden cursor-pointer"
							role="button"
							tabindex="0"
							on:click={() => viewDetails(pothole.id)}
							on:keydown={(e) => e.key === 'Enter' && viewDetails(pothole.id)}
						>
							<div class="aspect-video overflow-hidden">
								<img
									src={pothole.imageUrl}
									alt={`Pothole ${pothole.id}`}
									class="w-full h-full object-cover"
								/>
							</div>
							<div class="p-4">
								<div class="mb-2">
									<span class="text-purple-600 font-semibold">ID:</span>
									<span class="text-purple-900 ml-1">{pothole.id}</span>
								</div>
								<div class="mb-2">
									<span class="text-purple-600 font-semibold">Path ID:</span>
									<span class="text-purple-900 ml-1">{pothole.pathId}</span>
								</div>
								<div class="mb-2">
									<span class="text-purple-600 font-semibold">Location:</span>
									<span class="text-purple-900 ml-1 font-mono text-sm">[{pothole.location[0]}, {pothole.location[1]}]</span>
								</div>
								<div>
									<span class="text-purple-600 font-semibold">Timestamp:</span>
									<span class="text-purple-900 ml-1 text-sm">
										{pothole.timestamp ? pothole.timestamp.toString() : 'N/A'}
									</span>
								</div>
								<div class="mt-4">
									<div class="bg-purple-500 text-white px-3 py-1 rounded-full text-sm font-medium inline-block">
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
