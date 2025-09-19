import { db } from '../vitest.setup';
import { createRoverFixture } from './rover';

export const createPathFixture = async (rover_id?: number, routeWKT?: string) => {
	if (!rover_id) {
		const rover = await createRoverFixture();
		rover_id = rover.id;
	}

	routeWKT = routeWKT || 'LINESTRING(0 0, 1 1, 2 3)';

	const result = await db.execute(`
    INSERT INTO paths ("rover_id", route)
    VALUES (${rover_id}, ST_GeomFromText('${routeWKT}', 4326))
    RETURNING id, rover_id, timestamp, ST_AsGeoJSON(route) AS route;
  `);

	// Parse the GeoJSON string for consistency with API
	const row = result.rows[0];
	if (typeof row.route === 'string') {
		row.route = JSON.parse(row.route);
	}
	return row;
};
