import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { eq, desc } from 'drizzle-orm';
import { rovers, paths } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ params }) => {
	const roverId = Number(params.id);

	// Get the most recent path for this rover
	const latestPath = await db
		.select()
		.from(paths)
		.where(eq(paths.roverId, roverId))
		.orderBy(desc(paths.timestamp))
		.limit(1);

	if (latestPath.length > 0) {
		// Redirect to the most recent path
		throw redirect(302, `/rovers/${roverId}/${latestPath[0].id}`);
	}

	// If no paths exist, check if rover exists
	const rover = await db
		.select({
			name: rovers.name
		})
		.from(rovers)
		.where(eq(rovers.id, roverId));

	if (rover.length > 0) {
		// Rover exists but has no paths, redirect to map page to create one
		throw redirect(302, `/map/${roverId}`);
	}

	// Rover doesn't exist, redirect to rovers list
	throw redirect(302, '/rovers');
};
