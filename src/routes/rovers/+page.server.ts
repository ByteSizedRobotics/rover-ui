import { redirect } from '@sveltejs/kit';
import type { ServerLoad } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { rovers, paths } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

export const load: ServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}

	const roversData = await db.select().from(rovers);
	
	// Get the most recent path for each rover
	const roversWithPaths = await Promise.all(
		roversData.map(async (rover) => {
			const latestPath = await db
				.select({ id: paths.id })
				.from(paths)
				.where(eq(paths.roverId, rover.id))
				.orderBy(desc(paths.timestamp))
				.limit(1);
			
			return {
				...rover,
				latestPathId: latestPath.length > 0 ? latestPath[0].id : null
			};
		})
	);
	
	return { roversData: roversWithPaths };
};
