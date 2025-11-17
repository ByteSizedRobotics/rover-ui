<script lang="ts">
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { commandCenterManager, type CommandCenterStatus } from '../../../lib/ros2CommandCentre';

	const params = get(page).params;
	const roverId = params.id;

	let waypoints: { lat: number; lng: number }[] = [];
	let startAddr = '';
	let endAddr = '';
	let status = '';

	let connecting = false;
	let logs: Array<{ time: string; message: string; type: 'info' | 'success' | 'error' }> = [];

	// ROS2 Command Center Client
	let commandCenterClient = commandCenterManager.getClient(roverId);
	let commandCenterStatus: CommandCenterStatus = {
		isConnected: false,
		lastHeartbeat: 0,
		connectionErrors: 0,
		timestamp: 0,
		isNavigating: false,
		totalWaypoints: 0
	};

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

	onDestroy(() => {
		if (commandCenterClient?.isConnected) {
			commandCenterClient.disconnect();
		}
	});

	async function confirmLaunch() {
		status = 'Launching...';
		addLog('Starting launch sequence...', 'info');

		/* ============================================================================
		   TEMPORARY BYPASS: Force successful launch without ROS2 connection
		   
		   To re-enable ROS2 connection:
		   1. Comment out or remove the entire "TEMPORARY BYPASS" section (lines below)
		   2. Set FORCE_SUCCESS to false, or remove the if(FORCE_SUCCESS) block entirely
		   3. The code will then use the real ROS2 connection logic that follows
		   ============================================================================ */
		const FORCE_SUCCESS = false; // TODO NATHAN: Set to false to restore normal ROS2 behavior

		if (FORCE_SUCCESS) {
			addLog('[TEMP] Bypassing ROS2 - forcing successful launch', 'info');
			await new Promise((resolve) => setTimeout(resolve, 5000));
			
			addLog('Launch command and waypoints successfully sent to rover', 'success');
			status = 'Navigation started - Rover is heading to destination';

			// Create path entry in database
			addLog('Creating path entry in database...', 'info');
			const lineString = waypoints.map(wp => `${wp.lng} ${wp.lat}`).join(', ');
			const routeWKT = `LINESTRING(${lineString})`;
			
			addLog(`Waypoints: ${waypoints.length}, RouteWKT: ${routeWKT.substring(0, 50)}...`, 'info');
			addLog(`Rover ID: ${roverId} (type: ${typeof roverId})`, 'info');
			
			try {
				const pathRes = await fetch('/api/paths', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						rover_id: Number(roverId),
						routeWKT
					})
				});

				addLog(`API Response Status: ${pathRes.status} ${pathRes.statusText}`, 'info');

				if (!pathRes.ok) {
					const errorText = await pathRes.text();
					addLog(`API Error Response: ${errorText}`, 'error');
					throw new Error(`Failed to create path entry: ${pathRes.status} - ${errorText}`);
				}

			const pathData = await pathRes.json();
			const pathId = pathData.id;
			addLog(`Path created with ID: ${pathId}`, 'success');

			// Cache the latest path ID in command center manager
			commandCenterManager.setLatestPathId(roverId, pathId);

			// Store success notification for the rover page
				sessionStorage.setItem(
					`rover_launch_success_${roverId}`,
					JSON.stringify({
						message: `Rover ${roverId} is now navigating along its planned path with ${waypoints.length} waypoints.`,
						timestamp: Date.now(),
						waypointCount: waypoints.length
					})
				);

				// Add log about redirect
				addLog('Redirecting to rover control panel...', 'success');

				// add wait for 1 second before redirecting
				await new Promise((resolve) => setTimeout(resolve, 1000));

				// Redirect to rover page with pathId
				setTimeout(() => {
					goto(`/rovers/${encodeURIComponent(roverId)}/${pathId}`);
				}, 2000);
			} catch (pathError) {
				const errorMsg = pathError instanceof Error ? pathError.message : 'Unknown error';
				addLog(`Failed to create path entry: ${errorMsg}`, 'error');
				status = 'Launch failed - Could not create path';
			}
			return;
		}
		/* ============================================================================
		   END TEMPORARY BYPASS
		   ============================================================================ */

		try {
			// First, connect to ROS2 Command Center if not already connected
			if (!commandCenterClient.isConnected) {
				addLog('Connecting to ROS2 Command Center...', 'info');
				connecting = true;

				try {
					await commandCenterClient.connect({ enableCSICamera: false, enableUSBCamera: false });
					addLog('Successfully connected to ROS2 Command Center', 'success');
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : 'Unknown error';
					addLog(`Failed to connect to ROS2 Command Center: ${errorMsg}`, 'error');
					status = 'Launch failed - Could not connect to ROS2 Command Center';
					connecting = false;
					return;
				}
				connecting = false;
			}

			// Send to the existing API endpoint (for logging/database)
			// try {
			// 	const res = await fetch(`/api/launch/${encodeURIComponent(roverId)}`, {
			// 		method: 'POST',
			// 		headers: { 'Content-Type': 'application/json' },
			// 		body: JSON.stringify({ waypoints })
			// 	});

			// 	if (!res.ok) {
			// 		throw new Error(`API request failed with status ${res.status}`);
			// 	}

			// 	const contentType = res.headers.get('content-type');
			// 	if (!contentType || !contentType.includes('application/json')) {
			// 		const text = await res.text();
			// 		throw new Error(`Expected JSON response, got: ${text.substring(0, 100)}...`);
			// 	}

			// 	const j = await res.json();
			// 	addLog('Launch logged to database', 'info');
			// } catch (error) {
			// 	// Log API error but don't fail the launch
			// 	addLog(
			// 		`Database logging failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			// 		'error'
			// 	);
			// }

			// Now send launch command and waypoints to ROS2 Command Center
			if (commandCenterClient.isConnected && waypoints.length > 0) {
				addLog(`Sending launch command with ${waypoints.length} waypoints to rover...`, 'info');

				try {
					await commandCenterClient.launchRover(waypoints);
					addLog('Launch command and waypoints successfully sent to rover', 'success');
					status = 'Navigation started - Rover is heading to destination';

					// Create path entry in database
					addLog('Creating path entry in database...', 'info');
					const lineString = waypoints.map(wp => `${wp.lng} ${wp.lat}`).join(', ');
					const routeWKT = `LINESTRING(${lineString})`;
					
					addLog(`Waypoints: ${waypoints.length}, RouteWKT: ${routeWKT.substring(0, 50)}...`, 'info');
					addLog(`Rover ID: ${roverId} (type: ${typeof roverId})`, 'info');
					
					try {
						const pathRes = await fetch('/api/paths', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								rover_id: Number(roverId),
								routeWKT
							})
						});

						addLog(`API Response Status: ${pathRes.status} ${pathRes.statusText}`, 'info');

						if (!pathRes.ok) {
							const errorText = await pathRes.text();
							addLog(`API Error Response: ${errorText}`, 'error');
							throw new Error(`Failed to create path entry: ${pathRes.status} - ${errorText}`);
						}

					const pathData = await pathRes.json();
					const pathId = pathData.id;
					addLog(`Path created with ID: ${pathId}`, 'success');

					// Cache the latest path ID in command center manager
					commandCenterManager.setLatestPathId(roverId, pathId);

					// Store success notification for the rover page
						sessionStorage.setItem(
							`rover_launch_success_${roverId}`,
							JSON.stringify({
								message: `Rover ${roverId} is now navigating along its planned path with ${waypoints.length} waypoints.`,
								timestamp: Date.now(),
								waypointCount: waypoints.length
							})
						);

						// Add log about redirect
						addLog('Redirecting to rover control panel...', 'success');

						// add wait for 1 second before redirecting
						await new Promise((resolve) => setTimeout(resolve, 1000));

						// Redirect to rover page with pathId
						setTimeout(() => {
							goto(`/rovers/${encodeURIComponent(roverId)}/${pathId}`);
						}, 2000);
					} catch (pathError) {
						const errorMsg = pathError instanceof Error ? pathError.message : 'Unknown error';
						addLog(`Failed to create path entry: ${errorMsg}`, 'error');
						status = 'Launch failed - Could not create path';
					}
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : 'Unknown error';
					addLog(`Failed to send launch command: ${errorMsg}`, 'error');
					status = 'Launch failed - Could not send command to rover';
				}
			} else if (waypoints.length === 0) {
				addLog('No waypoints to send to navigation system', 'error');
				status = 'Launch failed - No waypoints available';
			} else {
				addLog('Failed to send waypoints - ROS2 Command Center connection lost', 'error');
				status = 'Launch failed - ROS2 Command Center connection issue';
			}
		} catch (err) {
			console.error(err);
			const errorMsg = err instanceof Error ? err.message : 'Unknown error';
			addLog(`Launch failed: ${errorMsg}`, 'error');
			status = 'Launch failed.';
		}
	}

	async function stopNavigation() {
		if (!commandCenterClient?.isConnected) {
			addLog('Cannot stop navigation: Not connected to ROS2 Command Center', 'error');
			return;
		}

		try {
			addLog('Stopping navigation...', 'info');
			await commandCenterClient.stopRover();
			addLog('Navigation stopped successfully', 'success');
			status = 'Navigation stopped';
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';
			addLog(`Failed to stop navigation: ${errorMsg}`, 'error');
		}
	}

	function addLog(message: string, type: 'info' | 'success' | 'error' = 'info') {
		logs = [
			...logs,
			{
				time: new Date().toLocaleTimeString(),
				message,
				type
			}
		];
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-6">
	<div class="container mx-auto max-w-4xl">
		<header class="page-header mb-6 rounded-2xl border border-blue-100 bg-white p-6 shadow-lg">
			<h1 class="title text-3xl font-bold text-blue-900">Launch Rover-{roverId}</h1>
			<div class="divider mt-4 h-1 rounded bg-gradient-to-r from-blue-500 to-blue-300"></div>
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
							<p class="instruction">
								Make sure the start address corresponds to the location where the rover will be
								dropped off.
							</p>
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

			<section class="launch-section mb-6 text-center">
				<button
					class="confirm rounded-lg bg-blue-500 px-8 py-3 font-bold text-white shadow-lg transition-colors duration-200 hover:bg-blue-600 disabled:bg-blue-300"
					on:click={confirmLaunch}
					disabled={connecting}
				>
					<span class="btn-text">
						{#if connecting}
							Connecting & Launching...
						{:else if commandCenterStatus.isNavigating}
							Navigation In Progress
						{:else}
							Confirm Launch
						{/if}
					</span>
				</button>
			</section>

			<section class="log-section rounded-2xl border border-blue-100 bg-white p-6 shadow-lg">
				<h2 class="section-title mb-4 text-2xl font-bold text-blue-900">Launch Log</h2>
				<div
					class="log-container max-h-64 overflow-y-auto rounded-lg border border-blue-200 bg-blue-50 p-4"
				>
					{#if logs.length > 0}
						{#each logs as log}
							<div
								class="log-entry mb-2 rounded p-2 {log.type === 'error'
									? 'bg-red-100 text-red-700'
									: log.type === 'success'
										? 'bg-green-100 text-green-700'
										: 'bg-blue-100 text-blue-700'}"
							>
								<span class="timestamp text-xs opacity-75">{log.time}</span>
								<span class="log-message ml-2">{log.message}</span>
							</div>
						{/each}
						{#if status}
							<div
								class="log-entry mb-2 rounded p-2 {status.includes('failed')
									? 'bg-red-100 text-red-700'
									: status.includes('Launching')
										? 'bg-blue-100 text-blue-700'
										: 'bg-green-100 text-green-700'}"
							>
								<span class="timestamp text-xs opacity-75">{new Date().toLocaleTimeString()}</span>
								<span class="log-message ml-2">{status}</span>
							</div>
						{/if}
					{:else}
						<p class="no-logs italic text-blue-600">
							No launch activity yet. Click "Confirm Launch" to begin.
						</p>
					{/if}
				</div>
			</section>
		{/if}

		<!-- Back to map (bottom-left) -->
		<div class="bottom-left fixed bottom-4 left-4 z-10">
			<a
				class="btn rounded-lg bg-blue-500 px-4 py-2 font-medium text-white shadow-lg transition-colors hover:bg-blue-600"
				href={`/map/${encodeURIComponent(roverId)}`}>← Back to Map</a
			>
		</div>
	</div>
</div>

<style>
	.container {
		max-width: 800px;
		margin: 0 auto;
		padding: 24px;
		font-family:
			'Inter',
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			sans-serif;
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

	.route-info,
	.launch-section,
	.log-section {
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
		max-height: 400px;
		min-height: 400px;
		overflow: auto;
	}

	.waypoints-section {
		flex: 1;
		display: flex;
		flex-direction: column;
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
		overflow: auto;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
		flex: 1;
		max-height: 400px;
		min-height: 400px;
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
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
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

	.confirm:disabled {
		background: linear-gradient(135deg, #9ca3af, #6b7280);
		cursor: not-allowed;
		transform: none;
		box-shadow: 0 2px 6px rgba(156, 163, 175, 0.3);
	}

	.confirm:disabled:hover {
		background: linear-gradient(135deg, #9ca3af, #6b7280);
		transform: none;
		box-shadow: 0 2px 6px rgba(156, 163, 175, 0.3);
	}

	.btn-text {
		position: relative;
		z-index: 1;
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
