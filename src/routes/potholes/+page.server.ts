import type { ServerLoad } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';

export const load: ServerLoad = async ({ fetch }) => {
    const res = await fetch('/api/potholes');
    if (!res.ok) throw error(500, 'Failed to fetch potholes');
    const potholes = await res.json();
    return { potholes };
};
