<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<main class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
	<!-- Meet the Team Section -->
	<div class="container mx-auto px-6 py-4">
		<div class="mx-auto mt-20 max-w-6xl">
			<div class="mb-12 text-center">
				<h2 class="mb-4 text-4xl font-bold text-gray-800">Meet the Team</h2>
				<p class="mx-auto max-w-2xl text-xl text-gray-600">
					Four passionate computer engineering students in their final year, working together to
					revolutionize autonomous rover technology
				</p>
			</div>

			<div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
				<!-- Team Member 1 -->
				<div
					class="group flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-8 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl"
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
					<h3 class="mb-2 text-xl font-bold text-gray-800">Nathan Gawargy</h3>
					<p class="mb-2 text-sm font-medium text-blue-600">Title (eg. Lead Developer)</p>
					<p class="text-center text-sm text-gray-600">
						Computer Engineering Student specializing in autonomous systems and robotics
					</p>
				</div>

				<!-- Team Member 2 -->
				<div
					class="group flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-8 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl"
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
					<h3 class="mb-2 text-xl font-bold text-gray-800">Maxime Couture</h3>
					<p class="mb-2 text-sm font-medium text-green-600">Title</p>
					<p class="text-center text-sm text-gray-600">
						Computer Engineering Student focusing on machine learning and computer vision
					</p>
				</div>

				<!-- Team Member 3 -->
				<div
					class="group flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-8 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl"
				>
					<div class="relative mb-6">
						<div
							class="absolute inset-0 rounded-full bg-purple-500/10 blur-xl transition-all duration-300 group-hover:blur-2xl"
						></div>
						<div
							class="relative h-32 w-32 overflow-hidden rounded-full border-4 border-purple-200 bg-gradient-to-br from-purple-100 to-purple-200 transition-all duration-300 group-hover:border-purple-300"
						>
							<!-- Team member photo -->
							<img src="/UE5_1.png" alt="Team Member 3" class="h-full w-full object-cover" />
						</div>
					</div>
					<h3 class="mb-2 text-xl font-bold text-gray-800">Syed Yead Zaman</h3>
					<p class="mb-2 text-sm font-medium text-purple-600">Title</p>
					<p class="text-center text-sm text-gray-600">
						Computer Engineering Student specializing in distributed systems and infrastructure
					</p>
				</div>

				<!-- Team Member 4 -->
				<div
					class="group flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-8 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl"
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
					<h3 class="mb-2 text-xl font-bold text-gray-800">Louis Marleau</h3>
					<p class="mb-2 text-sm font-medium text-orange-600">Title</p>
					<p class="text-center text-sm text-gray-600">
						Computer Engineering Student focusing on web development and user experience
					</p>
				</div>
			</div>

			<!-- Team Description -->
			<div class="mx-auto mt-12 max-w-4xl rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
				<div class="text-center">
					<h3 class="mb-4 text-2xl font-bold text-gray-800">Our Mission</h3>
					<p class="text-lg leading-relaxed text-gray-600">
						As final-year computer engineering students, we're passionate about pushing the boundaries
						of autonomous robotics. Our rover control system combines cutting-edge AI, real-time data
						processing, and intuitive design to create the next generation of infrastructure
						monitoring solutions.
					</p>
				</div>
			</div>
			<div class="mt-8 text-center">
				<button
					on:click={() => goto('/login')}
					class="rounded-lg bg-blue-600 px-8 py-3 text-lg font-semibold text-white shadow-lg transition-transform duration-300 hover:scale-105 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/50"
				>
					Login to Command Centre
				</button>
			</div>
		</div>
	</div>
</main>
