import {
	pgTable,
	serial,
	varchar,
	integer,
	timestamp,
	text,
	index,
	jsonb,
	geometry,
	doublePrecision
} from 'drizzle-orm/pg-core';

// -------------------
// User Authentication
// -------------------
export const user = pgTable('user', {
	id: text('id').primaryKey(),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull()
});

export const session = pgTable('session', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
});

// -------------------
// Rovers Table
// -------------------
export const rovers = pgTable('rovers', {
	id: serial('id').primaryKey().notNull(),
	name: varchar('name', { length: 100 }).notNull(),
	status: varchar('status', { length: 50 }).notNull().default('active'),
	ipAddress: varchar('ip_address', { length: 45 }).notNull() // IPv4/IPv6
});

// -------------------
// Paths Table
// -------------------
export const paths = pgTable(
	'paths',
	{
		id: serial('id').primaryKey().notNull(),
		roverId: integer('rover_id')
			.notNull()
			.references(() => rovers.id, { onDelete: 'cascade' }),
		route: geometry('route', { type: 'linestring', srid: 4326 }).notNull(),
		timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow()
	},
	(table) => [
		index('idx_paths_route').using('gist', table.route.asc().nullsLast().op('gist_geometry_ops_2d'))
	]
);

// -------------------
// Images Table
// -------------------
export const images = pgTable(
	'images',
	{
		id: serial('id').primaryKey().notNull(),
		pathId: integer('path_id')
			.notNull()
			.references(() => paths.id, { onDelete: 'cascade' }),
		imageUrl: text('image_url').notNull(),
		timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow(),
		location: geometry('location', { type: 'point', srid: 4326 }).notNull()
	},
	(table) => [
		index('idx_images_location').using(
			'gist',
			table.location.asc().nullsLast().op('gist_geometry_ops_2d')
		)
	]
);

// -------------------
// Detections Table
// -------------------
export const detections = pgTable('detections', {
	id: serial('id').primaryKey().notNull(),
	imageId: integer('image_id')
		.notNull()
		.references(() => images.id, { onDelete: 'cascade' }),
	bbox: jsonb('bbox').notNull(), // store [x_min, y_min, x_max, y_max] as JSON array
	confidence:
		// Use 'doublePrecision' for float values in drizzle-orm/pg-core
		// If you want single precision, use 'real'
		// Here, doublePrecision is more common for scores
		// import { doublePrecision } from "drizzle-orm/pg-core" at the top if not already
		doublePrecision('confidence').notNull(),
	areaScore: doublePrecision('area_score'),
	depthScore: doublePrecision('depth_score'),
	falsePositive: integer('false_positive').default(0) // or boolean if preferred
});

// -------------------
// Infer Types
// -------------------
export type Session = typeof session.$inferSelect;
export type User = typeof user.$inferSelect;
export type Rovers = typeof rovers.$inferSelect;
export type Paths = typeof paths.$inferSelect;
export type Images = typeof images.$inferSelect;
export type Detections = typeof detections.$inferSelect;
