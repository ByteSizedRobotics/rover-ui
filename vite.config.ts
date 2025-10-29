import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],

	server: {
		// TODO: NATHAN once UI/APIs running in docker container DONT need this anymore
		host: '0.0.0.0', // allows external connections (e.g., from Docker)
		port: 5173,
		allowedHosts: [
			'localhost',
			'127.0.0.1',
			'host.docker.internal' // 👈 allow Docker container requests
		]
	},

	test: {
		environment: 'node',
		fileParallelism: false,
		include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
		setupFiles: ['tests/vitest.setup.ts']
	}
});
