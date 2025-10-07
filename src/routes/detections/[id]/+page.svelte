<script lang="ts">
	import { goto } from '$app/navigation';

	export let data: {
		detection: {
			id: number;
			bbox: number[];
			confidence: number;
			areaScore: number | null;
			depthScore: number | null;
			falsePositive: number | null;
		};
		image: {
			id: number;
			imageUrl: string;
			timestamp: Date;
			location: [number, number];
		};
		path: {
			id: number;
			timestamp: Date;
		};
		rover: {
			id: number;
			name: string;
			ipAddress: string;
		};
	};

	function formatDate(date: Date | string): string {
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatCoordinate(coord: number): string {
		return coord.toFixed(6);
	}

	function formatPercentage(value: number): string {
		return (value * 100).toFixed(2) + '%';
	}

	function goBack() {
		goto('/potholes');
	}
</script>

<main class="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 p-8">
	<div class="container mx-auto max-w-6xl">
		<!-- Header with Back Button -->
		<div class="mb-6">
			<button
				on:click={goBack}
				class="flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium transition-colors"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
						clip-rule="evenodd"
					/>
				</svg>
				Back to Potholes
			</button>
		</div>

		<!-- Main Content Card -->
		<div class="bg-white rounded-2xl shadow-lg border border-purple-100 overflow-hidden">
			<!-- Header Section -->
			<div class="bg-gradient-to-r from-purple-600 to-purple-700 px-8 py-6">
				<h1 class="text-3xl font-bold text-white mb-2">Detection Details</h1>
				<p class="text-purple-100">Detection ID: #{data.detection.id}</p>
			</div>

			<!-- Content Grid -->
			<div class="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
				<!-- Image Section -->
				<div class="space-y-4">
					<div class="bg-purple-50 rounded-xl overflow-hidden border-2 border-purple-200">
						<img
							src="/{data.image.imageUrl}"
							alt="Detection {data.detection.id}"
							class="w-full h-auto object-contain"
						/>
					</div>
					<div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
						<h3 class="font-semibold text-purple-900 mb-2">Image Information</h3>
						<div class="space-y-2 text-sm">
							<div class="flex justify-between">
								<span class="text-purple-600">Image ID:</span>
								<span class="text-purple-900 font-medium">#{data.image.id}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-purple-600">Captured:</span>
								<span class="text-purple-900 font-medium"
									>{formatDate(data.image.timestamp)}</span
								>
							</div>
							<div class="flex justify-between">
								<span class="text-purple-600">Location:</span>
								<span class="text-purple-900 font-mono text-xs"
									>[{formatCoordinate(data.image.location[0])}, {formatCoordinate(
										data.image.location[1]
									)}]</span
								>
							</div>
						</div>
					</div>
				</div>

				<!-- Detection Details Section -->
				<div class="space-y-6">
					<!-- Detection Metrics -->
					<div class="bg-gradient-to-br from-purple-50 to-white border border-purple-200 rounded-xl p-6">
						<h2 class="text-xl font-bold text-purple-900 mb-4">Detection Metrics</h2>
						<div class="space-y-4">
							<!-- Confidence Score -->
							<div>
								<div class="flex justify-between items-center mb-2">
									<span class="text-purple-700 font-semibold">Confidence Score</span>
									<span class="text-2xl font-bold text-purple-900"
										>{formatPercentage(data.detection.confidence)}</span
									>
								</div>
								<div class="w-full bg-purple-200 rounded-full h-3 overflow-hidden">
									<div
										class="bg-gradient-to-r from-purple-500 to-purple-600 h-full rounded-full transition-all duration-500"
										style="width: {data.detection.confidence * 100}%"
									></div>
								</div>
							</div>

							<!-- Area Score -->
							{#if data.detection.areaScore !== null}
								<div>
									<div class="flex justify-between items-center mb-2">
										<span class="text-purple-700 font-semibold">Area Score</span>
										<span class="text-xl font-bold text-purple-900"
											>{formatPercentage(data.detection.areaScore)}</span
										>
									</div>
									<div class="w-full bg-purple-200 rounded-full h-2 overflow-hidden">
										<div
											class="bg-purple-400 h-full rounded-full transition-all duration-500"
											style="width: {data.detection.areaScore * 100}%"
										></div>
									</div>
								</div>
							{/if}

							<!-- Depth Score -->
							{#if data.detection.depthScore !== null}
								<div>
									<div class="flex justify-between items-center mb-2">
										<span class="text-purple-700 font-semibold">Depth Score</span>
										<span class="text-xl font-bold text-purple-900"
											>{formatPercentage(data.detection.depthScore)}</span
										>
									</div>
									<div class="w-full bg-purple-200 rounded-full h-2 overflow-hidden">
										<div
											class="bg-purple-400 h-full rounded-full transition-all duration-500"
											style="width: {data.detection.depthScore * 100}%"
										></div>
									</div>
								</div>
							{/if}

							<!-- Bounding Box -->
							<div class="pt-2 border-t border-purple-200">
								<span class="text-purple-700 font-semibold block mb-2">Bounding Box</span>
								<div class="grid grid-cols-2 gap-2 text-sm">
									<div class="bg-white rounded-lg p-3 border border-purple-100">
										<span class="text-purple-600 text-xs">X Min</span>
										<div class="text-purple-900 font-mono font-semibold">
											{data.detection.bbox[0]}
										</div>
									</div>
									<div class="bg-white rounded-lg p-3 border border-purple-100">
										<span class="text-purple-600 text-xs">Y Min</span>
										<div class="text-purple-900 font-mono font-semibold">
											{data.detection.bbox[1]}
										</div>
									</div>
									<div class="bg-white rounded-lg p-3 border border-purple-100">
										<span class="text-purple-600 text-xs">X Max</span>
										<div class="text-purple-900 font-mono font-semibold">
											{data.detection.bbox[2]}
										</div>
									</div>
									<div class="bg-white rounded-lg p-3 border border-purple-100">
										<span class="text-purple-600 text-xs">Y Max</span>
										<div class="text-purple-900 font-mono font-semibold">
											{data.detection.bbox[3]}
										</div>
									</div>
								</div>
							</div>

							<!-- False Positive Status -->
							{#if data.detection.falsePositive !== null}
								<div class="pt-2">
									<div
										class="flex items-center gap-2 px-4 py-3 rounded-lg {data.detection
											.falsePositive === 1
											? 'bg-red-50 border border-red-200'
											: 'bg-green-50 border border-green-200'}"
									>
										<div
											class="w-3 h-3 rounded-full {data.detection.falsePositive === 1
												? 'bg-red-500'
												: 'bg-green-500'}"
										></div>
										<span
											class="font-semibold {data.detection.falsePositive === 1
												? 'text-red-800'
												: 'text-green-800'}"
										>
											{data.detection.falsePositive === 1 ? 'False Positive' : 'Valid Detection'}
										</span>
									</div>
								</div>
							{/if}
						</div>
					</div>

					<!-- Context Information -->
					<div class="bg-purple-50 border border-purple-200 rounded-xl p-6">
						<h2 class="text-xl font-bold text-purple-900 mb-4">Context Information</h2>
						<div class="space-y-4">
							<!-- Rover Info -->
							<div>
								<h3 class="text-purple-700 font-semibold mb-2 flex items-center gap-2">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-5 w-5"
										viewBox="0 0 20 20"
										fill="currentColor"
									>
										<path
											d="M10 12a2 2 0 100-4 2 2 0 000 4z"
										/>
										<path
											fill-rule="evenodd"
											d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
											clip-rule="evenodd"
										/>
									</svg>
									Rover
								</h3>
								<div class="bg-white rounded-lg p-4 space-y-2 text-sm">
									<div class="flex justify-between">
										<span class="text-purple-600">Name:</span>
										<span class="text-purple-900 font-medium">{data.rover.name}</span>
									</div>
									<div class="flex justify-between">
										<span class="text-purple-600">ID:</span>
										<span class="text-purple-900 font-medium">#{data.rover.id}</span>
									</div>
									<div class="flex justify-between">
										<span class="text-purple-600">IP Address:</span>
										<span class="text-purple-900 font-mono text-xs">{data.rover.ipAddress}</span>
									</div>
								</div>
							</div>

							<!-- Path Info -->
							<div>
								<h3 class="text-purple-700 font-semibold mb-2 flex items-center gap-2">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-5 w-5"
										viewBox="0 0 20 20"
										fill="currentColor"
									>
										<path
											fill-rule="evenodd"
											d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
											clip-rule="evenodd"
										/>
									</svg>
									Path
								</h3>
								<div class="bg-white rounded-lg p-4 space-y-2 text-sm">
									<div class="flex justify-between">
										<span class="text-purple-600">Path ID:</span>
										<span class="text-purple-900 font-medium">#{data.path.id}</span>
									</div>
									<div class="flex justify-between">
										<span class="text-purple-600">Started:</span>
										<span class="text-purple-900 font-medium"
											>{formatDate(data.path.timestamp)}</span
										>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</main>
