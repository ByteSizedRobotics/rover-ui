<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageServerData } from '../$types';
	
	type User = {
		username: string;
		id: string | number;
	};
	
	export let data: PageServerData & { user: User };
</script>

<main class="flex flex-col items-center justify-center min-h-screen bg-gray-50">
	<div class="bg-white border rounded-xl shadow-lg p-10 w-full max-w-md text-center">
		<h1 class="text-2xl font-bold mb-2 text-blue-700">Hello, {data.user.username}!</h1>
		<p class="mb-6 text-gray-500">Your user ID is <span class="font-mono bg-gray-100 px-2 py-1 rounded">{data.user.id}</span></p>
		<form method="post" action="?/logout" use:enhance>
			<button class="btn bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-semibold shadow">Sign out</button>
		</form>
	</div>
</main>

