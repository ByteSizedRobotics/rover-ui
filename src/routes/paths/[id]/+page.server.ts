import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const id = Number(params.id);
	if (isNaN(id)) throw error(400, 'Invalid path ID');

	const res = await fetch(`/api/paths/${id}`);
	if (res.status === 404) throw error(404, 'Path not found');
	if (!res.ok) throw error(500, 'Failed to fetch path');

	const path = await res.json();
	return { path };
};
