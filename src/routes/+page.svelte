<script lang="ts">
	import type { PageServerData } from "./$types";
	let { data }: { data: PageServerData } = $props();
  </script>
  
  <div class="container mx-auto p-4">
	<h1 class="text-2xl font-bold mb-4">Available rovers</h1>
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
	  {#each data.roversData as rover}
		<div class="card w-full bg-base-300 shadow-xl">
		  <figure>
			{#if rover.status === "active"}
			  <img src="./LiveMetrics.png" alt={rover.name} class="w-full object-cover" />
			{:else}
			<img src="./PathPlan.png" alt={rover.name} class="w-full object-cover" />
			{/if}
		  </figure>
		  <div class="card-body">
			<h2 class="card-title">{rover.name}</h2>
			{#if rover.status === "active"}
			  <p class="badge badge-primary bg-success">{rover.status}</p>
			{:else}
			  <p class="badge badge-primary bg-error">{rover.status}</p>
			{/if}
			<div class="card-actions justify-end">
				{#if rover.status === "active"}
					<!-- Active rovers: only Dashboard -->
					<a href={`/rover/${rover.id}`} class="btn btn-primary">Live Metrics</a>
				{:else}
					<!-- Inactive rovers: only Route -->
					<a href="/map" class="btn btn-primary">Path Planner</a>
				{/if}
			</div>
		  </div>
		</div>
	  {/each}
	</div>
  </div>
  