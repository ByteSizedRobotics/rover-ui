<script lang="ts">
import { goto } from '$app/navigation';

function goTo(page: string) {
    goto(`/${page}`);
}
</script>

<main class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
    <!-- Header Section -->
    <div class="container mx-auto px-6 py-4">
        <div class="text-center mb-8">
            <h1 class="text-4xl font-bold text-black mb-2">
                Rover Control Centre
            </h1>
            <p class="text-xl text-gray-600 max-w-2xl mx-auto mb-2">
                Your comprehensive platform for autonomous rover management, path planning, and infrastructure monitoring
            </p>
        </div>

        <!-- Navigation Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <!-- Rovers Card -->
            <button 
                type="button" 
                class="group bg-white border border-gray-200 rounded-2xl shadow-lg p-10 flex flex-col items-center cursor-pointer hover:shadow-2xl hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500/20" 
                on:click={() => goTo('rovers')} 
                aria-label="Go to Rovers"
            >
                <div class="relative mb-6">
                    <div class="absolute inset-0 bg-blue-500/10 rounded-full blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                    <img src="/LiveMetrics.png" alt="Rovers" class="relative w-34 h-34 group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h2 class="text-2xl font-bold mb-3 text-gray-800 group-hover:text-blue-600 transition-colors">Rovers</h2>
                <p class="text-gray-600 text-center leading-relaxed">
                    Manage and deploy autonomous rovers. Track performance, and view live status updates instantly.
                </p>
                <div class="mt-4 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-medium group-hover:bg-blue-100 transition-colors">
                    Manage Fleet →
                </div>
            </button>

            <!-- Paths Card -->
            <button 
                type="button" 
                class="group bg-white border border-gray-200 rounded-2xl shadow-lg p-10 flex flex-col items-center cursor-pointer hover:shadow-2xl hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-green-500/20" 
                on:click={() => goTo('paths')} 
                aria-label="Go to Paths"
            >
                <div class="relative mb-6">
                    <div class="absolute inset-0 bg-green-500/10 rounded-full blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                    <img src="/PathHistory.png" alt="Paths" class="relative w-34 h-34 group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h2 class="text-2xl font-bold mb-3 text-gray-800 group-hover:text-green-600 transition-colors">Path History</h2>
                <p class="text-gray-600 text-center leading-relaxed">
                    Explore and analyze previous rover paths and routes to plan optimal navigation stategies.
                </p>
                <div class="mt-4 px-4 py-2 bg-green-50 text-green-600 rounded-full text-sm font-medium group-hover:bg-green-100 transition-colors">
                    View Routes →
                </div>
            </button>

            <!-- Potholes Card -->
            <button 
                type="button" 
                class="group bg-white border border-gray-200 rounded-2xl shadow-lg p-10 flex flex-col items-center cursor-pointer hover:shadow-2xl hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-purple-500/20 md:col-span-2 lg:col-span-1" 
                on:click={() => goTo('potholes')} 
                aria-label="Go to Potholes"
            >
                <div class="relative mb-6">
                    <div class="absolute inset-0 bg-purple-500/10 rounded-full blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                    <img src="/PotholeExplorer.png" alt="Potholes" class="relative w-34 h-34 group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h2 class="text-2xl font-bold mb-3 text-gray-800 group-hover:text-purple-600 transition-colors">Pothole Explorer</h2>
                <p class="text-gray-600 text-center leading-relaxed">
                    Review and inspect detected potholes. Analyze data and plan maintenance based on severity.
                </p>
                <div class="mt-4 px-4 py-2 bg-purple-50 text-purple-600 rounded-full text-sm font-medium group-hover:bg-purple-100 transition-colors">
                    Explore Data →
                </div>
            </button>
        </div>

        <!-- Stats Section -->
        <div class="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div class="text-center">
                <div class="text-3xl font-bold text-blue-600 mb-2">Autonomous</div>
                <div class="text-gray-600">Monitor Infrastructure</div>
            </div>
            <div class="text-center">
                <div class="text-3xl font-bold text-green-600 mb-2">Real-time</div>
                <div class="text-gray-600">Data Processing</div>
            </div>
            <div class="text-center">
                <div class="text-3xl font-bold text-purple-600 mb-2">AI-Powered</div>
                <div class="text-gray-600">Detection & Analysis</div>
            </div>
        </div>
    </div>
</main>
