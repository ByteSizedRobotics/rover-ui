import {
	pgTable,
	serial,
	varchar,
	integer,
	timestamp,
	text,
	foreignKey,
	geometry,
	index,
  } from "drizzle-orm/pg-core";
  import { sql } from "drizzle-orm";
  
  // User Authentication
  export const user = pgTable("user", {
	id: text("id").primaryKey(),
	username: text("username").notNull().unique(),
	passwordHash: text("password_hash").notNull(),
  });
  
  export const session = pgTable("session", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  });
  
  // Rovers Table
  export const rovers = pgTable("rovers", {
	id: serial("id").primaryKey().notNull(),
	name: varchar("name", { length: 100 }).notNull(),
	status: varchar("status", { length: 50 }).notNull().default("active"),
  });
  
  // Paths Table
  export const paths = pgTable("paths", {
	id: serial("id").primaryKey().notNull(),
	roverId: integer("rover_id")
	  .notNull()
	  .references(() => rovers.id, { onDelete: "cascade" }),
	route: geometry("route", { type: "linestring", srid: 4326 }).notNull(), // PostGIS LineString
	timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
  }, (table) => [
	// Create spatial index on the route column for better performance
	index("idx_paths_route").using("gist", table.route.asc().nullsLast().op("gist_geometry_ops_2d")),
  ]);
  
  // Potholes Table
  export const potholes = pgTable("potholes", {
	id: serial("id").primaryKey().notNull(),
	pathId: integer("path_id").notNull().references(() => paths.id, { onDelete: "cascade" }),
	location: geometry("location", { type: "point", srid: 4326 }).notNull(), // PostGIS Point
	severity: integer("severity").notNull(),
	imageUrl: text("image_url").notNull(),
  }, (table) => [
	// Create spatial index on the location column for better performance
	index("idx_potholes_location").using("gist", table.location.asc().nullsLast().op("gist_geometry_ops_2d")),
  ]);
  
  // Infer Types
  export type Session = typeof session.$inferSelect;
  export type User = typeof user.$inferSelect;
  export type Rovers = typeof rovers.$inferSelect;
  export type Paths = typeof paths.$inferSelect;
  export type Potholes = typeof potholes.$inferSelect;
  