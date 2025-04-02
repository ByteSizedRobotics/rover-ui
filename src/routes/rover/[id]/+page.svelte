<script lang="ts">
    import type { PageServerData } from "./$types";
    
    let { data }: { data: PageServerData } = $props();
</script>

<div class="flex flex-col items-center justify-center min-h-screen bg-base-200 text-center">
    <div class="card w-96 bg-base-100 shadow-xl">
        <div class="card-body">
            {#if data?.name}
                <h1 class="card-title text-2xl font-bold">Hi, {data.name}!</h1>
            {/if}
            <p class="text-gray-500">Welcome to the rover control panel.</p>
            <div class="card-actions justify-center mt-4">
                <a href="/manual-ctrl" class="btn btn-primary">Manual Control</a>
            </div>
        </div>
    </div>
</div>