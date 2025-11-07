import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { rovers, paths } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ params }) => {
	const id = params.id;
	const pathId = params.pathId;

	let roverName = null;
	let pathTimestamp = null;

	// Get rover name
	if (id) {
		const rover = await db
			.select({
				name: rovers.name
			})
			.from(rovers)
			.where(eq(rovers.id, Number(id)));

		if (rover.length > 0) {
			roverName = rover[0].name;
		}
	}

	// Get path timestamp
	if (pathId) {
		const path = await db
			.select({
				timestamp: paths.timestamp
			})
			.from(paths)
			.where(eq(paths.id, Number(pathId)));

		if (path.length > 0) {
			pathTimestamp = path[0].timestamp;
		}
	}

	return { 
		name: roverName,
		pathId: pathId,
		pathTimestamp: pathTimestamp
	};
};
