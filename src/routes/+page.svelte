<script lang="ts">
	import type { PageServerData } from "./$types";

	// Example data for cards
	let cards = [
	  {
		id: 1,
		title: "Rover 1",
		status: "Active",
	  },
	  {
		id: 2,
		title: "Rover 2",
		status: "Inactive",
	  },
	  {
		id: 3,
		title: "Rover 3",
		status: "Inactive",
	  }
	];

	let { data }: { data: PageServerData } = $props();
	console.log(data);
  </script>
  
  <div class="container mx-auto p-4">
	{#if data.roversData.length === 0}
	<h1 class="text-2xl font-bold mb-4">Sample rovers</h1>
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
	  {#each cards as card}
		<div class="card w-full bg-base-300 shadow-xl">
		  <figure>
			{#if card.status === "Active"}
			  <img src="./rover.png" alt={card.title} class="w-full object-cover" />
			{:else}
			<img src="./rover.png" alt={card.title} class="w-full object-cover brightness-0" />
			{/if}
		  </figure>
		  <div class="card-body">
			<h2 class="card-title">{card.title}</h2>
			{#if card.status === "Active"}
			  <p class="badge badge-primary bg-success">{card.status}</p>
			{:else}
			  <p class="badge badge-primary bg-error">{card.status}</p>
			{/if}
			<div class="card-actions justify-end">
			  <a href="/rover/{card.id}" class="btn btn-primary">Dashboard</a>
			</div>
		  </div>
		</div>
	  {/each}
	</div>
	{:else}
	<h1 class="text-2xl font-bold mb-4">Available rovers</h1>
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
	  {#each data.roversData as rover}
		<div class="card w-full bg-base-300 shadow-xl">
		  <figure>
			{#if rover.status === "active"}
			  <img src="./rover.png" alt={rover.name} class="w-full object-cover" />
			{:else}
			<img src="./rover.png" alt={rover.name} class="w-full object-cover brightness-0" />
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
			  <a href="/rover/{rover.id}" class="btn btn-primary">Dashboard</a>
			</div>
		  </div>
		</div>
	  {/each}
	</div>
	{/if}

  </div>
  