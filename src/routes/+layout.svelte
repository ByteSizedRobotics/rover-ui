<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	let { children } = $props();
</script>

<div class="navbar bg-base-300">
	<div class="navbar-start">
		<a href="/" class="btn btn-ghost text-xl">Control Centre</a>
	</div>
	<div class="navbar-center hidden lg:flex">
		{#if $page.url.pathname !== '/'}
			<ul class="menu menu-horizontal flex gap-4 px-1">
				<li>
					<a
						href="/rovers"
						class="rounded-lg bg-blue-500 px-4 py-2 text-white transition hover:bg-blue-700"
						>Rovers</a
					>
				</li>
				<li>
					<a
						href="/paths"
						class="rounded-lg bg-green-500 px-4 py-2 text-white transition hover:bg-green-700"
						>Paths</a
					>
				</li>
				<li>
					<a
						href="/potholes"
						class="rounded-lg bg-purple-500 px-4 py-2 text-white transition hover:bg-purple-700"
						>Potholes</a
					>
				</li>
			</ul>
		{/if}
	</div>
	<div class="navbar-end">
		<a href="/account" class="btn">Account</a>
	</div>
</div>
{@render children()}
