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

<main class="p-8">
	<h1 class="mb-4 text-2xl font-bold">Potholes</h1>
	{#if !data.images || data.images.length === 0}
		<p>No potholes found.</p>
	{:else}
		<ul class="space-y-4">
			{#each data.images as pothole}
				<li>
					<button
						type="button"
						class="flex w-full cursor-pointer items-center gap-4 rounded border p-4 text-left hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
						on:click={() => viewDetails(pothole.id)}
					>
						<img
							src={pothole.imageUrl}
							alt={`Pothole ${pothole.id}`}
							class="h-16 w-16 rounded object-cover"
						/>
						<div>
							<div><strong>ID:</strong> {pothole.id}</div>
							<div><strong>Path ID:</strong> {pothole.pathId}</div>
							<div><strong>Location:</strong> [{pothole.location[0]}, {pothole.location[1]}]</div>
							<div>
								<strong>Timestamp:</strong>
								{pothole.timestamp ? pothole.timestamp.toString() : 'N/A'}
							</div>
						</div>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</main>
