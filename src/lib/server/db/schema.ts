import {
	pgTable,
	serial,
	text,
	integer,
	timestamp,
	point,
	varchar,
	uuid,
  } from "drizzle-orm/pg-core";
  
  // User Authentication
  export const user = pgTable("user", {
	id: text("id").primaryKey(), // Use UUID for scalability
	username: text("username").notNull().unique(),
	passwordHash: text("password_hash").notNull(),
  });
  
  export const session = pgTable("session", {
	id: text("id").primaryKey(), // Use UUID for session ID
	userId: text("user_id")
	  .notNull()
	  .references(() => user.id, { onDelete: "cascade" }), // Cascade delete sessions when a user is deleted
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  });
  
  // Rovers Table
  export const rovers = pgTable("rovers", {
	id: serial("id").primaryKey(),
	name: varchar("name", { length: 100 }).notNull(),
  });
  
  // Paths Table
  export const paths = pgTable("paths", {
	id: serial("id").primaryKey(),
	roverId: integer("rover_id")
	  .notNull()
	  .references(() => rovers.id, { onDelete: "cascade" }), // Each path belongs to a rover
	startLocation: point("start_location").notNull(), // PostGIS Point
	endLocation: point("end_location").notNull(), // PostGIS Point
	timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(), // Auto-filled timestamp
  });
  
  // Potholes Table
  export const potholes = pgTable("potholes", {
	id: serial("id").primaryKey(),
	pathId: integer("path_id")
	  .notNull()
	  .references(() => paths.id, { onDelete: "cascade" }), // Foreign key to paths
	location: point("location").notNull(), // PostGIS Point
	severity: integer("severity").notNull(),
	imageUrl: text("image_url").notNull(), // URL to the image
  });
  
  // Infer Types
  export type Session = typeof session.$inferSelect;
  export type User = typeof user.$inferSelect;
  export type Rovers = typeof rovers.$inferSelect;
  export type Paths = typeof paths.$inferSelect;
  export type Potholes = typeof potholes.$inferSelect;
  