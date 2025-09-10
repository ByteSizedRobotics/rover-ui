import type { ServerLoad } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';

export const load: ServerLoad = async ({ fetch }) => {
    const res = await fetch('/api/images');
    if (!res.ok) throw error(500, 'Failed to fetch images');
    const images = await res.json();
    return { images };
};
