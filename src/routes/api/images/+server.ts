import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { images } from '$lib/server/db/schema';
import { sql, eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const pathId = url.searchParams.get('pathId');
		
		// Fetch images, optionally filtered by pathId
		let allImages;
		if (pathId) {
			allImages = await db.select().from(images).where(eq(images.pathId, Number(pathId)));
		} else {
			allImages = await db.select().from(images);
		}
		
		return new Response(JSON.stringify(allImages), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('Error fetching images:', err);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();

		const file = formData.get('image') as File;
		const pathIdStr = formData.get('pathId') as string;

		if (!file) {
			return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
		}

		// Parse pathId from form data, default to null if not provided
		let pathId: number | null = null;
		if (pathIdStr) {
			pathId = parseInt(pathIdStr, 10);
			if (isNaN(pathId)) {
				return new Response(JSON.stringify({ error: 'Invalid pathId' }), { status: 400 });
			}
		}

		// Require pathId - if not provided, return error
		if (pathId === null) {
			return new Response(JSON.stringify({ error: 'pathId is required' }), { status: 400 });
		}

		// Ensure uploads directory exists
		const uploadDir = path.join(process.cwd(), 'static/uploads');
		if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

		// TODO: retrieve fields like latitude, longitude from rover
		var latitude = 0;
		var longitude = 0;
		
		// Insert into database first to get the image_id
		const result = await db
			.insert(images)
			.values({
				pathId,
				imageUrl: '', // Temporary placeholder, will update after we have the image_id
				timestamp: new Date(),
				location: sql`ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)`
			})
			.returning();

		const imageId = result[0].id;
		
		// Generate filename with path_id and image_id for uniqueness
		const filename = `path_${pathId}_image_${imageId}.jpg`;
		const filePath = path.join(uploadDir, filename);
		
		// Save the uploaded file with the proper filename
		const buffer = Buffer.from(await file.arrayBuffer());
		fs.writeFileSync(filePath, buffer);

		// Update the database record with the correct image URL
		const relativeImagePath = path.join('uploads', filename).replace(/\\/g, '/');
		await db
			.update(images)
			.set({ imageUrl: relativeImagePath })
			.where(sql`id = ${imageId}`);

		return new Response(JSON.stringify({ image_id: imageId }), {
			status: 201,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('Error inserting image:', err);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
};
