<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { get } from 'svelte/store';
    import type { PageServerData } from "./$types";
    
    let { data }: { data: PageServerData } = $props();
    
    // Notification state
    let notification = $state<{
        message: string;
        waypointCount: number;
        show: boolean;
    } | null>(null);
    
    const params = get(page).params;
    const roverId = params.id;
    
    onMount(() => {
        // Check for launch success notification
        if (typeof window !== 'undefined' && roverId) {
            const notificationKey = `rover_launch_success_${roverId}`;
            const storedNotification = sessionStorage.getItem(notificationKey);
            
            if (storedNotification) {
                try {
                    const notificationData = JSON.parse(storedNotification);
                    // Show notification if it's recent (within last 5 minutes)
                    const isRecent = Date.now() - notificationData.timestamp < 5 * 60 * 1000;
                    
                    if (isRecent) {
                        notification = {
                            message: notificationData.message,
                            waypointCount: notificationData.waypointCount,
                            show: true
                        };
                        
                        // Auto-hide notification after 10 seconds
                        setTimeout(() => {
                            if (notification) {
                                notification.show = false;
                            }
                        }, 10000);
                    }
                    
                    // Clear the notification from storage regardless
                    sessionStorage.removeItem(notificationKey);
                } catch (error) {
                    console.error('Failed to parse launch notification:', error);
                }
            }
        }
    });
    
    function dismissNotification() {
        if (notification) {
            notification.show = false;
        }
    }
</script>

<div class="flex flex-col items-center justify-center min-h-screen bg-base-200 text-center">
    <!-- Launch Success Notification -->
    {#if notification?.show}
        <div class="notification-banner">
            <div class="notification-content">
                <div class="notification-icon">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <div class="notification-text">
                    <h3 class="notification-title">🚀 Launch Successful!</h3>
                    <p class="notification-message">{notification.message}</p>
                    <p class="notification-details">The rover is now autonomously navigating to its destination.</p>
                </div>
                <button class="notification-close" onclick={dismissNotification} aria-label="Dismiss notification">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        </div>
    {/if}

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

<style>
    .notification-banner {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        max-width: 600px;
        width: 90%;
        animation: slideDown 0.3s ease-out;
    }

    .notification-content {
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
        display: flex;
        align-items: flex-start;
        gap: 12px;
        position: relative;
    }

    .notification-icon {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        margin-top: 2px;
    }

    .notification-text {
        flex: 1;
        text-align: left;
    }

    .notification-title {
        font-weight: 600;
        font-size: 1.1rem;
        margin: 0 0 4px 0;
    }

    .notification-message {
        font-size: 0.9rem;
        margin: 0 0 4px 0;
        opacity: 0.95;
    }

    .notification-details {
        font-size: 0.8rem;
        margin: 0;
        opacity: 0.8;
        font-style: italic;
    }

    .notification-close {
        flex-shrink: 0;
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: background-color 0.2s ease;
    }

    .notification-close:hover {
        background: rgba(255, 255, 255, 0.1);
    }

    @keyframes slideDown {
        from {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
        }
        to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    }
</style>