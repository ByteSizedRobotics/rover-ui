import { db } from '$lib/server/db';
import { detections } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = Number(params.id);
	if (!id) {
		return new Response(JSON.stringify({ error: 'Invalid detection ID' }), { status: 400 });
	}
	const body = await request.json();
	// Only allow updating specific fields
	const allowedFields = ['areaScore', 'depthScore', 'falsePositive'];
	const updates: Record<string, any> = {};
	for (const key of allowedFields) {
		if (key in body) updates[key] = body[key];
	}
	if (Object.keys(updates).length === 0) {
		return new Response(JSON.stringify({ error: 'No valid fields to update' }), { status: 400 });
	}
	const result = await db.update(detections).set(updates).where(eq(detections.id, id)).returning();
	if (!result[0]) {
		return new Response(JSON.stringify({ error: 'Detection not found' }), { status: 404 });
	}
	return new Response(JSON.stringify(result[0]), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
};
