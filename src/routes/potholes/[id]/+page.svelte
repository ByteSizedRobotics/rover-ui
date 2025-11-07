<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	export let data: {
		image: any;
		detections: Array<any>;
	};

	function goBack() {
		goto('/potholes');
	}

	function viewDetection(id: number) {
		goto(`/detections/${id}?imageId=${data.image.id}`);
	}
</script>

<main class="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 p-8">
	<div class="container mx-auto max-w-6xl">
		<div class="mb-6 rounded-2xl border border-purple-100 bg-white p-6 shadow-lg">
			<button on:click={goBack} class="mb-4 text-sm text-purple-600">← Back</button>
			<h1 class="mb-4 text-2xl font-bold text-purple-900">Pothole #{data.image.id}</h1>

			<div class="mb-4">
				<img src={`/${data.image.imageUrl}`} alt={`Pothole ${data.image.id}`} class="w-full object-contain rounded-lg" />
			</div>

			<div class="mb-4">
				<strong>Captured:</strong> {data.image.timestamp ? new Date(data.image.timestamp).toString() : 'N/A'}
			</div>

			<div class="mb-4">
				<strong>Detections:</strong>
			</div>

			{#if !data.detections || data.detections.length === 0}
				<div class="rounded-lg border border-purple-200 bg-purple-50 p-4">No detections found for this image.</div>
			{:else}
				<div class="grid grid-cols-1 gap-4">
					{#each data.detections as d}
						<div class="rounded-lg border border-purple-200 bg-white p-4 shadow-sm cursor-pointer hover:bg-purple-50" on:click={() => viewDetection(d.id)}>
							<div class="flex justify-between items-center">
								<div>
									<span class="font-semibold text-purple-600">Detection ID:</span>
									<span class="ml-2 text-purple-900">{d.id}</span>
								</div>
								<div class="text-sm text-purple-600">Confidence: {d.confidence != null ? d.confidence.toFixed(3) : 'N/A'}</div>
							</div>
							<div class="mt-2 text-sm text-purple-700">
								Area Score: {d.areaScore != null ? d.areaScore.toFixed(2) : 'N/A'} • Depth Score: {d.depthScore != null ? d.depthScore.toFixed(2) : 'N/A'}
							</div>
							<div class="mt-2 text-xs text-gray-500">
								False Positive: {d.falsePositive === 1 ? 'Yes' : d.falsePositive === 0 ? 'No' : 'Unknown'}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</main>
