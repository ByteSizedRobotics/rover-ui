<script lang="ts">
  import { page } from '$app/stores';
  import { get } from 'svelte/store';

  const params = get(page).params;
  const roverId = params.id;

  let waypoints: { lat: number; lng: number }[] = [];
  let startAddr = '';
  let endAddr = '';
  let status = '';

  // Read waypoints from sessionStorage
  const key = `launch_waypoints_${roverId}`;
  const raw = typeof window !== 'undefined' ? sessionStorage.getItem(key) : null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.waypoints) {
        waypoints = parsed.waypoints;
        startAddr = parsed.start || '';
        endAddr = parsed.end || '';
      } else if (Array.isArray(parsed)) {
        waypoints = parsed;
      }
    } catch (err) {
      console.error('Failed to parse saved waypoints', err);
    }
  }

  async function confirmLaunch() {
    status = 'Launching...';
    try {
      const res = await fetch(`/api/launch/${encodeURIComponent(roverId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waypoints })
      });
      const j = await res.json();
      status = j.message || 'Launched.';
    } catch (err) {
      console.error(err);
      status = 'Launch failed.';
    }
  }
</script>

<div class="container">
  <header class="page-header">
    <h1 class="title">Launch Rover {roverId}</h1>
    <div class="divider"></div>
  </header>

  {#if waypoints.length === 0}
    <div class="empty-state">
      <p>No saved waypoints found for this path.</p>
      <p class="hint">Please set a route first using the map.</p>
    </div>
  {:else}
    <section class="route-info">
      <h2 class="section-title">Route Information</h2>
      <div class="route-container">
        <div class="destinations">
          <div class="destination-item">
            <strong class="label">Start Address:</strong>
            <div class="address">{startAddr}</div>
            <p class="instruction">Make sure the start address corresponds to the location where the rover will be dropped off.</p>
          </div>
          <div class="destination-item">
            <strong class="label">End Address:</strong>
            <div class="address">{endAddr}</div>
          </div>
        </div>
        
        <div class="waypoints-section">
          <div class="waypoints-box">
            <p class="wp-count">GPS waypoints: {waypoints.length}</p>
            <ul class="waypoints-list">
              {#each waypoints as wp}
                <li class="waypoint-item">{wp.lat}, {wp.lng}</li>
              {/each}
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section class="launch-section">
      <button class="confirm" on:click={confirmLaunch}>
        <span class="btn-text">Confirm Launch</span>
      </button>
    </section>

    <section class="log-section">
      <h2 class="section-title">Launch Log</h2>
      <div class="log-container">
        {#if status}
          <div class="log-entry {status.includes('failed') ? 'error' : status.includes('Launching') ? 'info' : 'success'}">
            <span class="timestamp">{new Date().toLocaleTimeString()}</span>
            <span class="log-message">{status}</span>
          </div>
        {:else}
          <p class="no-logs">No launch activity yet. Click "Confirm Launch" to begin.</p>
        {/if}
      </div>
    </section>
  {/if}

  <!-- Back to map (bottom-left) -->
  <div class="bottom-left">
    <a class="btn" href={`/map/${encodeURIComponent(roverId)}`}>← Back to Map</a>
  </div>
</div>

<style>
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 24px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #1f2937;
  }

  .page-header {
    margin-bottom: 32px;
  }

  .title {
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 16px 0;
  }

  .divider {
    height: 3px;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    border-radius: 2px;
    width: 80px;
  }

  .empty-state {
    text-align: center;
    padding: 48px 24px;
    background: #f9fafb;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
  }

  .empty-state p {
    margin: 8px 0;
    font-size: 1.1rem;
  }

  .hint {
    color: #6b7280 !important;
    font-size: 0.9rem !important;
  }

  .route-info, .launch-section, .log-section {
    margin-bottom: 32px;
  }

  .route-container {
    display: flex;
    gap: 24px;
    align-items: stretch;
  }

  .destinations {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .waypoints-section {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .subsection-title {
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 12px 0;
    display: flex;
    align-items: center;
  }

  .subsection-title::before {
    content: '';
    display: inline-block;
    width: 3px;
    height: 16px;
    background: #8b5cf6;
    margin-right: 8px;
    border-radius: 2px;
  }

  .log-section {
    margin-bottom: 80px;
  }

  .log-container {
    background: #111827;
    border-radius: 12px;
    padding: 16px;
    min-height: 120px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace;
    overflow-y: auto;
    max-height: 300px;
  }

  .log-entry {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .log-entry.info {
    background: rgba(59, 130, 246, 0.1);
    color: #93c5fd;
    border-left: 3px solid #3b82f6;
  }

  .log-entry.success {
    background: rgba(34, 197, 94, 0.1);
    color: #86efac;
    border-left: 3px solid #22c55e;
  }

  .log-entry.error {
    background: rgba(239, 68, 68, 0.1);
    color: #fca5a5;
    border-left: 3px solid #ef4444;
  }

  .timestamp {
    color: #9ca3af;
    white-space: nowrap;
    font-size: 0.8rem;
  }

  .log-message {
    flex: 1;
  }

  .no-logs {
    color: #6b7280;
    text-align: center;
    font-style: italic;
    margin: 32px 0;
    font-size: 0.9rem;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
  }

  .section-title::before {
    content: '';
    display: inline-block;
    width: 4px;
    height: 20px;
    background: #3b82f6;
    margin-right: 12px;
    border-radius: 2px;
  }

  .destinations {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  }

  .destination-item {
    margin-bottom: 20px;
  }

  .destination-item:last-child {
    margin-bottom: 0;
  }

  .label {
    color: #374151;
    font-weight: 600;
    margin-bottom: 8px;
    display: block;
  }

  .address {
    color: #1f2937;
    font-weight: 400;
    font-size: 0.95rem;
    background: #f8fafc;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    margin-bottom: 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace;
    line-height: 1.4;
  }

  .instruction {
    margin: 0;
    color: #6b7280;
    font-size: 0.875rem;
    font-style: italic;
    line-height: 1.5;
  }

  .waypoints-box {
    border: 1px solid #e5e7eb;
    padding: 16px;
    border-radius: 12px;
    background: #ffffff;
    max-height: 240px;
    overflow: auto;
    max-width: 420px;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    flex: 1;
  }

  .wp-count {
    margin: 0 0 12px 0;
    color: #6b7280;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .waypoints-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .waypoint-item {
    margin-bottom: 8px;
    padding: 6px 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace;
    font-size: 0.875rem;
    color: #475569;
  }

  .waypoint-item:last-child {
    margin-bottom: 0;
  }

  .launch-section {
    text-align: center;
    padding: 24px;
    background: #fafafa;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
  }

  .confirm {
    background: linear-gradient(135deg, #dc2626, #b91c1c);
    color: white;
    padding: 14px 28px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }

  .confirm::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
    transition: left 0.5s;
  }

  .confirm:hover::before {
    left: 100%;
  }

  .confirm:hover {
    background: linear-gradient(135deg, #b91c1c, #991b1b);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(220, 38, 38, 0.4);
  }

  .confirm:active {
    transform: translateY(0);
  }

  .btn-text {
    position: relative;
    z-index: 1;
  }

  .status {
    margin: 16px 0 0 0;
    font-weight: 500;
    padding: 8px 16px;
    border-radius: 6px;
    display: inline-block;
  }

  .status.success {
    background: #d1fae5;
    color: #065f46;
    border: 1px solid #a7f3d0;
  }

  .status.error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fca5a5;
  }

  .bottom-left {
    position: fixed;
    left: 16px;
    bottom: 16px;
    z-index: 1002;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: #3b82f6;
    color: white;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    transition: all 0.2s ease;
  }

  .btn:hover {
    background: #2563eb;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }
</style>
