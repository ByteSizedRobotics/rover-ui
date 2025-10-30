import type { ServerLoad } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';

export const load: ServerLoad = async ({ fetch }) => {
	const res = await fetch('/api/paths');
	if (!res.ok) throw error(500, 'Failed to fetch paths');
	const paths = await res.json();
	return { paths };
};
