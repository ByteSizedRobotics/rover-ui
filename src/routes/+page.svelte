<script lang="ts">
import { goto } from '$app/navigation';

function goTo(page: string) {
    goto(`/${page}`);
}
</script>

<main class="flex flex-col items-center justify-center min-h-screen bg-gray-50">
    <h1 class="text-3xl font-bold mb-8 text-gray-800">Welcome to Rover UI</h1>
    <div class="flex flex-col gap-8 w-full max-w-xl">
        <button type="button" class="bg-white border rounded-xl shadow p-8 flex flex-col items-center cursor-pointer hover:shadow-lg transition focus:outline-none" on:click={() => goTo('rovers')} aria-label="Go to Rovers">
            <img src="/rover.png" alt="Rovers" class="w-16 h-16 mb-4" />
            <h2 class="text-xl font-semibold mb-2">Rovers</h2>
            <p class="text-gray-500 text-center">View and manage all rovers in the system.</p>
        </button>
        <button type="button" class="bg-white border rounded-xl shadow p-8 flex flex-col items-center cursor-pointer hover:shadow-lg transition focus:outline-none" on:click={() => goTo('paths')} aria-label="Go to Paths">
            <img src="/PathPlan.png" alt="Paths" class="w-16 h-16 mb-4" />
            <h2 class="text-xl font-semibold mb-2">Paths</h2>
            <p class="text-gray-500 text-center">Explore and edit rover paths and routes.</p>
        </button>
        <button type="button" class="bg-white border rounded-xl shadow p-8 flex flex-col items-center cursor-pointer hover:shadow-lg transition focus:outline-none" on:click={() => goTo('potholes')} aria-label="Go to Potholes">
            <img src="/LiveMetrics.png" alt="Potholes" class="w-16 h-16 mb-4" />
            <h2 class="text-xl font-semibold mb-2">Potholes</h2>
            <p class="text-gray-500 text-center">Review and inspect detected potholes.</p>
        </button>
    </div>
</main>
