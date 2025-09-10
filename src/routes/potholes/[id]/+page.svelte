<script lang="ts">
    import type { PageData } from './$types';
    export let data: PageData;

    const image = data.image;
</script>

<main class="p-8 max-w-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4">Image Details</h1>
    {#if image}
        <div class="border rounded p-6 flex flex-col items-center gap-4">
            <img src={image.imageUrl} alt={`Image ${image.id}`} class="w-48 h-48 object-cover rounded mb-4" />
            <div class="w-full">
                <div><strong>ID:</strong> {image.id}</div>
                <div><strong>Location:</strong> [{image.location[0]}, {image.location[1]}]</div>
                <div><strong>Timestamp:</strong> {image.timestamp ? image.timestamp.toString() : 'N/A'}</div>
                <div><strong>Path ID:</strong> {image.pathId}</div>
            </div>
        </div>
    {:else}
        <p>Image not found.</p>
    {/if}
</main>
