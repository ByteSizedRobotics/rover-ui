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

	function calculateSeverity(): { category: string; color: string } {
		// Calculate the maximum total score from all detections
		let maxTotalScore = -1;
		
		if (data.detections && data.detections.length > 0) {
			for (const detection of data.detections) {
				const areaScore = detection.areaScore ?? 0;
				const depthScore = detection.depthScore ?? 0;
				const totalScore = areaScore + depthScore;
				if (totalScore > maxTotalScore) {
					maxTotalScore = totalScore;
				}
			}
		}

		// Determine category based on total score
		let category: string;
		let color: string;

		if (maxTotalScore >= 1.5 && maxTotalScore <= 2.0) {
			category = "Critical Risk";
			color = "bg-red-600";
		} else if (maxTotalScore >= 1.0 && maxTotalScore < 1.5) {
			category = "High Risk";
			color = "bg-orange-500";
		} else if (maxTotalScore >= 0.6 && maxTotalScore < 1.0) {
			category = "Moderate Risk";
			color = "bg-yellow-500";
		} else if (maxTotalScore >= 0.0 && maxTotalScore < 0.6) {
			category = "Low Risk";
			color = "bg-green-500";
		} else {
			category = "NA";
			color = "bg-gray-400";
		}

		return { category, color };
	}

	$: severity = calculateSeverity();
</script>

<main class="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 p-8">
	<div class="container mx-auto max-w-6xl">
		<div class="mb-6 rounded-2xl border border-purple-100 bg-white p-6 shadow-lg">
			<button on:click={goBack} class="mb-4 text-sm text-purple-600">← Back</button>
			<div class="mb-4 flex items-center gap-3">
				<h1 class="text-3xl font-bold text-purple-900">Pothole #{data.image.id}</h1>
				<span class="{severity.color} text-white px-4 py-2 rounded-full text-lg font-semibold">
					{severity.category}
				</span>
			</div>

			<div class="mb-8 flex justify-center">
				<img src={`/${data.image.imageUrl}`} alt={`Pothole ${data.image.id}`} class="max-w-3xl w-full object-contain rounded-lg" />
			</div>

			<div class="mb-8 text-2xl">
				<strong class="font-bold text-black">Captured:</strong> <span class="text-black">{data.image.timestamp ? new Date(data.image.timestamp).toString() : 'N/A'}</span>
			</div>

			<div class="mb-6 text-2xl font-bold text-black">
				Detections:
			</div>

			{#if !data.detections || data.detections.length === 0}
				<div class="rounded-lg border border-purple-200 bg-purple-50 p-4 text-xl">No detections found for this image.</div>
			{:else}
				<div class="grid grid-cols-1 gap-4">
					{#each data.detections as d}
						<div class="rounded-lg border border-purple-200 bg-white p-6 shadow-sm cursor-pointer hover:bg-purple-50" on:click={() => viewDetection(d.id)}>
							<div class="flex justify-between items-center">
								<div class="text-2xl">
									<span class="font-semibold text-purple-600">Detection ID:</span>
									<span class="ml-2 text-purple-900">{d.id}</span>
								</div>
								<div class="text-2xl text-purple-600">Confidence: {d.confidence != null ? d.confidence.toFixed(3) : 'N/A'}</div>
							</div>
							<div class="mt-3 text-xl text-purple-700">
								Area Score: {d.areaScore != null ? d.areaScore.toFixed(2) : 'N/A'} Depth Score: {d.depthScore != null ? d.depthScore.toFixed(2) : 'N/A'}
							</div>
							<div class="mt-3 text-lg text-gray-500">
								False Positive: {d.falsePositive === 1 ? 'Yes' : d.falsePositive === 0 ? 'No' : 'Unknown'}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</main>
