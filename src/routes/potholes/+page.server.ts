import type { ServerLoad } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';

export const load: ServerLoad = async ({ fetch }) => {
	const res = await fetch('/api/images');
	if (!res.ok) throw error(500, 'Failed to fetch images');
	const images = await res.json();
	
	// Fetch detections for each image
	const imagesWithDetections = await Promise.all(
		images.map(async (image: any) => {
			const detectionsRes = await fetch(`/api/detections?imageId=${image.id}`);
			const detections = detectionsRes.ok ? await detectionsRes.json() : [];
			return { ...image, detections };
		})
	);
	
	return { images: imagesWithDetections };
};
