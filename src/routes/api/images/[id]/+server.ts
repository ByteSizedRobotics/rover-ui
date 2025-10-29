import { db } from '$lib/server/db';
import { images } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	if (!id) {
		return new Response(JSON.stringify({ error: 'Invalid image ID' }), { status: 400 });
	}

	try {
		const image = await db.select().from(images).where(eq(images.id, id)).limit(1);
		if (image.length === 0) {
			return new Response(JSON.stringify({ error: 'Image not found' }), { status: 404 });
		}

		return new Response(JSON.stringify(image[0]), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('Error fetching image:', err);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	if (!id) {
		return new Response(JSON.stringify({ error: 'Invalid image ID' }), { status: 400 });
	}

	try {
		const result = await db.delete(images).where(eq(images.id, id)).returning();
		if (!result[0]) {
			return new Response(JSON.stringify({ error: 'Image not found' }), { status: 404 });
		}

		return new Response(JSON.stringify({ message: 'Image deleted successfully' }), { status: 200 });
	} catch (err) {
		console.error('Error deleting image:', err);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
};
