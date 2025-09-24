<script lang="ts">
	import { goto } from '$app/navigation';

	function goTo(page: string) {
		goto(`/${page}`);
	}
</script>

<main class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
	<!-- Header Section -->
	<div class="container mx-auto px-6 py-4">
		<div class="mb-8 text-center">
			<h1 class="mb-2 text-4xl font-bold text-black">Rover Control Centre</h1>
			<p class="mx-auto mb-2 max-w-2xl text-xl text-gray-600">
				Your comprehensive platform for autonomous rover management, path planning, and
				infrastructure monitoring
			</p>
		</div>

		<!-- Navigation Cards -->
		<div class="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
			<!-- Rovers Card -->
			<button
				type="button"
				class="group flex cursor-pointer flex-col items-center rounded-2xl border border-gray-200 bg-white p-10 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/20"
				on:click={() => goTo('rovers')}
				aria-label="Go to Rovers"
			>
				<div class="relative mb-6">
					<div
						class="absolute inset-0 rounded-full bg-blue-500/10 blur-xl transition-all duration-300 group-hover:blur-2xl"
					></div>
					<img
						src="/LiveMetrics.png"
						alt="Rovers"
						class="w-34 h-34 relative transition-transform duration-300 group-hover:scale-110"
					/>
				</div>
				<h2
					class="mb-3 text-2xl font-bold text-gray-800 transition-colors group-hover:text-blue-600"
				>
					Rovers
				</h2>
				<p class="text-center leading-relaxed text-gray-600">
					Manage and deploy autonomous rovers. Track performance, and view live status updates
					instantly.
				</p>
				<div
					class="mt-4 rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 transition-colors group-hover:bg-blue-100"
				>
					Manage Fleet →
				</div>
			</button>

			<!-- Paths Card -->
			<button
				type="button"
				class="group flex cursor-pointer flex-col items-center rounded-2xl border border-gray-200 bg-white p-10 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-green-500/20"
				on:click={() => goTo('paths')}
				aria-label="Go to Paths"
			>
				<div class="relative mb-6">
					<div
						class="absolute inset-0 rounded-full bg-green-500/10 blur-xl transition-all duration-300 group-hover:blur-2xl"
					></div>
					<img
						src="/PathHistory.png"
						alt="Paths"
						class="w-34 h-34 relative transition-transform duration-300 group-hover:scale-110"
					/>
				</div>
				<h2
					class="mb-3 text-2xl font-bold text-gray-800 transition-colors group-hover:text-green-600"
				>
					Path History
				</h2>
				<p class="text-center leading-relaxed text-gray-600">
					Explore and analyze previous rover paths and routes to plan optimal navigation stategies.
				</p>
				<div
					class="mt-4 rounded-full bg-green-50 px-4 py-2 text-sm font-medium text-green-600 transition-colors group-hover:bg-green-100"
				>
					View Routes →
				</div>
			</button>

			<!-- Potholes Card -->
			<button
				type="button"
				class="group flex cursor-pointer flex-col items-center rounded-2xl border border-gray-200 bg-white p-10 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/20 md:col-span-2 lg:col-span-1"
				on:click={() => goTo('potholes')}
				aria-label="Go to Potholes"
			>
				<div class="relative mb-6">
					<div
						class="absolute inset-0 rounded-full bg-purple-500/10 blur-xl transition-all duration-300 group-hover:blur-2xl"
					></div>
					<img
						src="/PotholeExplorer.png"
						alt="Potholes"
						class="w-34 h-34 relative transition-transform duration-300 group-hover:scale-110"
					/>
				</div>
				<h2
					class="mb-3 text-2xl font-bold text-gray-800 transition-colors group-hover:text-purple-600"
				>
					Pothole Explorer
				</h2>
				<p class="text-center leading-relaxed text-gray-600">
					Review and inspect detected potholes. Analyze data and plan maintenance based on severity.
				</p>
				<div
					class="mt-4 rounded-full bg-purple-50 px-4 py-2 text-sm font-medium text-purple-600 transition-colors group-hover:bg-purple-100"
				>
					Explore Data →
				</div>
			</button>
		</div>

		<!-- Stats Section -->
		<div class="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-3">
			<div class="text-center">
				<div class="mb-2 text-3xl font-bold text-blue-600">Autonomous</div>
				<div class="text-gray-600">Navigation System</div>
			</div>
			<div class="text-center">
				<div class="mb-2 text-3xl font-bold text-green-600">Real-time</div>
				<div class="text-gray-600">Data Processing</div>
			</div>
			<div class="text-center">
				<div class="mb-2 text-3xl font-bold text-purple-600">AI-Powered</div>
				<div class="text-gray-600">Detection & Analysis</div>
			</div>
		</div>
	</div>
</main>
