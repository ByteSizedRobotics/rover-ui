<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<main class="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
	<!-- Hero Section -->
	<div class="relative h-screen w-full overflow-hidden">
		<!-- Background Image with Overlay -->
		<div class="absolute inset-0">
			<div class="absolute inset-0">
				<img
					src="/RoverHero.jpg"
					alt="Autonomous Rover"
					class="h-full w-full object-cover"
					style="mask-image: linear-gradient(to bottom, black 70%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, black 70%, transparent 100%);"
				/>
			</div>
			<!-- Gradient Overlay for better text visibility -->
			<div class="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/70 via-30% to-transparent to-50%"></div>
		</div>

		<!-- Hero Content -->
		<div class="relative z-10 flex h-full items-center">
			<div class="container mx-auto px-6 lg:px-12">
				<div class="max-w-3xl space-y-6">
					<!-- Main Title -->
					<h1 class="text-5xl font-extrabold leading-tight text-white sm:text-6xl lg:text-7xl">
						Autonomous<br />
						<span class="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
							Pothole Detection
						</span><br />
						Rover
					</h1>

					<!-- Subtitle -->
					<p class="max-w-xl text-xl text-gray-300 sm:text-2xl">
						Next-generation infrastructure monitoring powered by AI and autonomous robotics
					</p>

					<!-- CTA Button -->
					<div class="pt-4">
						<button
							on:click={() => goto('/login')}
							class="group relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-8 py-4 text-lg font-semibold text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-blue-500/50 focus:outline-none focus:ring-4 focus:ring-blue-500/50"
						>
							<span class="relative z-10">Enter Command Centre</span>
							<div class="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Scroll Indicator -->
		<div class="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 animate-bounce">
			<svg class="h-8 w-8 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
			</svg>
		</div>
	</div>

	<!-- Meet the Team Section -->
	<div class="container mx-auto px-6 py-24">
		<div class="mx-auto max-w-6xl">
			<div class="mb-12 text-center">
				<h2 class="mb-4 text-4xl font-bold text-white">Meet the Team</h2>
				<p class="mx-auto max-w-2xl text-xl text-gray-300">
					Four passionate computer engineering students in their final year, working together to
					revolutionize autonomous rover technology
				</p>
			</div>

			<div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
				<!-- Team Member 1 -->
				<div
					class="group flex flex-col items-center rounded-2xl border border-slate-700 bg-slate-800/50 p-8 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/20"
				>
					<div class="relative mb-6">
						<div
							class="absolute inset-0 rounded-full bg-blue-500/10 blur-xl transition-all duration-300 group-hover:blur-2xl"
						></div>
						<div
							class="relative h-32 w-32 overflow-hidden rounded-full border-4 border-blue-200 bg-gradient-to-br from-blue-100 to-blue-200 transition-all duration-300 group-hover:border-blue-300"
						>
							<!-- Team member photo -->
							<img
								src="/nathan.JPEG"
								alt="Team Member 1"
								class="h-32 w-32 object-cover scale-150"
    							style="object-position: 20% 20px;"
							/>
						</div>
					</div>
					<h3 class="mb-2 text-xl font-bold text-white">Nathan Gawargy</h3>
					<p class="mb-2 text-sm font-medium text-blue-400">Full-Stack & AI Engineer</p>
					<p class="text-center text-sm text-gray-300">
						Frontend, Backend & AI/ML Developer
					</p>
				</div>

				<!-- Team Member 2 -->
				<div
					class="group flex flex-col items-center rounded-2xl border border-slate-700 bg-slate-800/50 p-8 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-cyan-500 hover:shadow-2xl hover:shadow-cyan-500/20"
				>
					<div class="relative mb-6">
						<div
							class="absolute inset-0 rounded-full bg-green-500/10 blur-xl transition-all duration-300 group-hover:blur-2xl"
						></div>
						<div
							class="relative h-32 w-32 overflow-hidden rounded-full border-4 border-green-200 bg-gradient-to-br from-green-100 to-green-200 transition-all duration-300 group-hover:border-green-300"
						>
							<!-- Team member photo -->
							<img
								src="/maxime2.JPG"
								alt="Team Member 2"
								class="h-full w-full object-cover scale-200"
							/>
						</div>
					</div>
					<h3 class="mb-2 text-xl font-bold text-white">Maxime Couture</h3>
					<p class="text-center mb-2 text-sm font-medium text-cyan-400">Full-Stack & Robotics Engineer</p>
					<p class="text-center text-sm text-gray-300">
						Frontend, Hardware & Robotics Developer
					</p>
				</div>

				<!-- Team Member 3 -->
				<div
					class="group flex flex-col items-center rounded-2xl border border-slate-700 bg-slate-800/50 p-8 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-purple-500 hover:shadow-2xl hover:shadow-purple-500/20"
				>
					<div class="relative mb-6">
						<div
							class="absolute inset-0 rounded-full bg-purple-500/10 blur-xl transition-all duration-300 group-hover:blur-2xl"
						></div>
						<div
							class="relative h-32 w-32 overflow-hidden rounded-full border-4 border-purple-200 bg-gradient-to-br from-purple-100 to-purple-200 transition-all duration-300 group-hover:border-purple-300"
						>
							<!-- Team member photo -->
							<img src="/yead.JPG" alt="Team Member 3" class="h-full w-full object-cover" />
						</div>
					</div>
					<h3 class="mb-2 text-xl font-bold text-white">Syed Yead Zaman</h3>
					<p class="mb-2 text-sm font-medium text-purple-400">Backend & DevOps Engineer</p>
					<p class="text-center text-sm text-gray-300">
						Backend, infrastructure & DevOps Developer
					</p>
				</div>

				<!-- Team Member 4 -->
				<div
					class="group flex flex-col items-center rounded-2xl border border-slate-700 bg-slate-800/50 p-8 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-orange-500 hover:shadow-2xl hover:shadow-orange-500/20"
				>
					<div class="relative mb-6">
						<div
							class="absolute inset-0 rounded-full bg-orange-500/10 blur-xl transition-all duration-300 group-hover:blur-2xl"
						></div>
						<div
							class="relative h-32 w-32 overflow-hidden rounded-full border-4 border-orange-200 bg-gradient-to-br from-orange-100 to-orange-200 transition-all duration-300 group-hover:border-orange-300"
						>
							<!-- Team member photo -->
							<img
								src="/louis.JPG"
								alt="Team Member 4"
								class="h-32 w-32 object-cover scale-150"
    							style="object-position: 30% -15px;"
							/>
						</div>
					</div>
					<h3 class="mb-2 text-xl font-bold text-white">Louis Marleau</h3>
					<p class="text-center mb-2 text-sm font-medium text-orange-400">Hardware & Robotics Engineer</p>
					<p class="text-center text-sm text-gray-300">
						Hardware & Robotics Developer
					</p>
				</div>
			</div>

			<div class="mt-8 text-center">
				<button
					on:click={() => goto('/login')}
					class="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-8 py-3 text-lg font-semibold text-white shadow-lg transition-transform duration-300 hover:scale-105 hover:shadow-blue-500/50 focus:outline-none focus:ring-4 focus:ring-blue-500/50"
				>
					Login to Command Centre
				</button>
			</div>
		</div>
	</div>
</main>
