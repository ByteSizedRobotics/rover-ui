<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<div
	class="relative flex min-h-screen items-start justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 pt-16"
>
	<!-- Decorative Background Elements -->
	<div class="absolute inset-0 overflow-hidden">
		<div
			class="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-blue-200/30 blur-3xl"
		></div>
		<div
			class="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-purple-200/30 blur-3xl"
		></div>
	</div>

	<div class="relative w-full max-w-md px-6">
		<!-- Header -->
		<div class="mb-8 text-center">
			<h1 class="mb-2 text-4xl font-bold text-gray-800">Rover Control Centre</h1>
			<p class="text-lg text-gray-600">Sign in to manage your autonomous fleet</p>
		</div>

		<!-- Login Card -->
		<div
			class="rounded-2xl border border-gray-200 bg-white p-8 shadow-2xl transition-all duration-300 hover:shadow-3xl"
		>
			<h2 class="mb-6 text-2xl font-bold text-gray-800">Welcome back</h2>

			<form method="post" action="?/login" use:enhance>
				<!-- Username Input -->
				<div class="mb-6">
					<label for="username" class="mb-2 block text-sm font-medium text-gray-700">
						Username
					</label>
					<div class="relative">
						<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 16 16"
								fill="currentColor"
								class="h-5 w-5 text-gray-400"
							>
								<path
									d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12.735 14c.618 0 1.093-.561.872-1.139a6.002 6.002 0 0 0-11.215 0c-.22.578.254 1.139.872 1.139h9.47Z"
								/>
							</svg>
						</div>
						<input
							type="text"
							id="username"
							name="username"
							class="w-full rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-4 text-gray-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
							placeholder="Enter your username"
							required
						/>
					</div>
				</div>

				<!-- Password Input -->
				<div class="mb-6">
					<label for="password" class="mb-2 block text-sm font-medium text-gray-700">
						Password
					</label>
					<div class="relative">
						<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 16 16"
								fill="currentColor"
								class="h-5 w-5 text-gray-400"
							>
								<path
									fill-rule="evenodd"
									d="M14 6a4 4 0 0 1-4.899 3.899l-1.955 1.955a.5.5 0 0 1-.353.146H5v1.5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-2.293a.5.5 0 0 1 .146-.353l3.955-3.955A4 4 0 1 1 14 6Zm-4-2a.75.75 0 0 0 0 1.5.5.5 0 0 1 .5.5.75.75 0 0 0 1.5 0 2 2 0 0 0-2-2Z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<input
							type="password"
							id="password"
							name="password"
							class="w-full rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-4 text-gray-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
							placeholder="Enter your password"
							value="password"
							required
						/>
					</div>
				</div>

				<!-- Error Message -->
				{#if form?.message}
					<div class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
						{form.message}
					</div>
				{/if}

				<!-- Buttons -->
				<div class="space-y-3">
					<button
						type="submit"
						class="group w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:bg-blue-700 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-500/50"
					>
						<span class="transition-transform group-hover:scale-105">Sign In</span>
					</button>

					<button
						type="submit"
						formaction="?/register"
						class="group w-full rounded-lg border-2 border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition-all duration-300 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
					>
						<span class="transition-transform group-hover:scale-105">Create Account</span>
					</button>
				</div>
			</form>

			<!-- Footer -->
			<div class="mt-6 text-center text-sm text-gray-600">
				<p>Access your rover management dashboard</p>
			</div>
		</div>
	</div>
</div>
