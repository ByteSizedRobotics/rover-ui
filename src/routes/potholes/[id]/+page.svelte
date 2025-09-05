<script lang="ts">
    import type { PageData } from './$types';
    export let data: PageData;

    const pothole = data.pothole;
</script>

<main class="p-8 max-w-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4">Pothole Details</h1>
    {#if pothole}
        <div class="border rounded p-6 flex flex-col items-center gap-4">
            <img src="/uploads/cat.jpeg" alt={`Pothole ${pothole.id}`} class="w-48 h-48 object-cover rounded mb-4" />
            <div class="w-full">
                <div><strong>ID:</strong> {pothole.id}</div>
                <div><strong>Severity:</strong> {pothole.severity}</div>
                <div><strong>Path ID:</strong> {pothole.pathId}</div>
                {#if pothole.depth}
                    <div><strong>Depth:</strong> {pothole.depth}</div>
                {/if}
                {#if pothole.area}
                    <div><strong>Area:</strong> {pothole.area}</div>
                {/if}
            </div>
        </div>
    {:else}
        <p>Pothole not found.</p>
    {/if}
</main>
