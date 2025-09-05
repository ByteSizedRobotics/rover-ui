<script lang="ts">
import { goto } from '$app/navigation';

export let data: { potholes: Pothole[] };

interface Pothole {
    id: number;
    pathId: number;
    severity: number;
    imageUrl: string;
}

function viewDetails(id: number) {
    goto(`/potholes/${id}`);
}
</script>

<main class="p-8">
    <h1 class="text-2xl font-bold mb-4">Potholes</h1>
    {#if !data.potholes || data.potholes.length === 0}
        <p>No potholes found.</p>
    {:else}
        <ul class="space-y-4">
            {#each data.potholes as pothole}
                <li>
                    <button
                        type="button"
                        class="w-full text-left border rounded p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        on:click={() => viewDetails(pothole.id)}
                    >
                        <img src={pothole.imageUrl} alt={`Pothole ${pothole.id}`} class="w-16 h-16 object-cover rounded" />
                        <div>
                            <div><strong>ID:</strong> {pothole.id}</div>
                            <div><strong>Severity:</strong> {pothole.severity}</div>
                            <div><strong>Path ID:</strong> {pothole.pathId}</div>
                        </div>
                    </button>
                </li>
            {/each}
        </ul>
    {/if}
</main>
