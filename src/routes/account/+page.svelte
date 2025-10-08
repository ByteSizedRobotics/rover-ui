<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<main class="flex min-h-screen flex-col items-center justify-center bg-gray-50">
	<div class="w-full max-w-md rounded-xl border bg-white p-10 text-center shadow-lg">
		<h1 class="mb-2 text-2xl font-bold text-blue-700">Hello, {data.user.username}!</h1>
		<p class="mb-6 text-gray-500">
			Your user ID is <span class="rounded bg-gray-100 px-2 py-1 font-mono">{data.user.id}</span>
		</p>
		<form method="post" action="?/logout" use:enhance>
			<button
				class="btn rounded-lg bg-red-500 px-6 py-2 font-semibold text-white shadow hover:bg-red-600"
				>Sign out</button
			>
		</form>
	</div>
</main>
