import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { images } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();

		const file = formData.get('image') as File;

		if (!file) {
			return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
		}

		// Ensure uploads directory exists
		const uploadDir = path.join(process.cwd(), 'static/uploads');
		if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

		// Save the uploaded file
		const filePath = path.join(uploadDir, file.name);
		const buffer = Buffer.from(await file.arrayBuffer());
		fs.writeFileSync(filePath, buffer);

		// Insert into database
		const relativeImagePath = path.join('uploads', file.name);

		// TODO: retrieve fields like pathId, latitude, longitude from rover
		var pathId = 1;
		var latitude = 0;
		var longitude = 0;
		const result = await db
			.insert(images)
			.values({
				pathId,
				imageUrl: relativeImagePath,
				timestamp: new Date(),
				location: sql`ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)`
			})
			.returning();

		return new Response(JSON.stringify({ image_id: result[0].id }), {
			status: 201,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('Error inserting image:', err);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
};

export const GET: RequestHandler = async () => {
	try {
		// Fetch all images from the database
		const allImages = await db.select().from(images);
		return new Response(JSON.stringify(allImages), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('Error fetching images:', err);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
};
