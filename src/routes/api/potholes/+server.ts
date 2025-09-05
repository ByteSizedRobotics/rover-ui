import type { RequestHandler } from '@sveltejs/kit';
import { db } from "$lib/server/db";
import { potholes } from "$lib/server/db/schema";
import { sql } from "drizzle-orm";
import fs from 'fs';
import path from 'path';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const formData = await request.formData();

        const pathId = parseInt(formData.get('pathId') as string);
        const latitude = parseFloat(formData.get('latitude') as string);
        const longitude = parseFloat(formData.get('longitude') as string);
        const severity = parseInt(formData.get('severity') as string);
        const file = formData.get('image') as File;

        if (!pathId || !latitude || !longitude || !severity || !file) {
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
        const result = await db
            .insert(potholes)
            .values({
            pathId,
            location: sql`ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)`,
            severity,
            imageUrl: relativeImagePath
            })
            .returning();

        return new Response(JSON.stringify(result[0]), { status: 201, headers: { "Content-Type": "application/json" } });
    } catch (err) {
        console.error("Error inserting pothole:", err);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
};

export const GET: RequestHandler = async () => {
    try {
        // Fetch all potholes from the database
        const allPotholes = await db.select().from(potholes);
        return new Response(JSON.stringify(allPotholes), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        console.error('Error fetching potholes:', err);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
};
