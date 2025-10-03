-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE "detections" (
	"id" serial PRIMARY KEY NOT NULL,
	"image_id" integer NOT NULL,
	"bbox" jsonb NOT NULL,
	"confidence" double precision NOT NULL,
	"area_score" double precision,
	"depth_score" double precision,
	"false_positive" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" serial PRIMARY KEY NOT NULL,
	"path_id" integer NOT NULL,
	"image_url" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now(),
	"location" geometry(point) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"rover_id" integer NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now(),
	"location" geometry(point) NOT NULL,
	"altitude" double precision NOT NULL,
	"roll" double precision NOT NULL,
	"pitch" double precision NOT NULL,
	"yaw" double precision NOT NULL,
	"temperature" double precision NOT NULL,
	"voltage" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paths" (
	"id" serial PRIMARY KEY NOT NULL,
	"rover_id" integer NOT NULL,
	"route" geometry(LINESTRING, 4326) NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rovers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"last_heartbeat" timestamp with time zone DEFAULT now(),
	"ip_address" varchar(45) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "detections" ADD CONSTRAINT "detections_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_path_id_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_rover_id_rovers_id_fk" FOREIGN KEY ("rover_id") REFERENCES "public"."rovers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paths" ADD CONSTRAINT "paths_rover_id_rovers_id_fk" FOREIGN KEY ("rover_id") REFERENCES "public"."rovers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_images_location" ON "images" USING gist ("location" gist_geometry_ops_2d);--> statement-breakpoint
CREATE INDEX "idx_logs_location" ON "logs" USING gist ("location" gist_geometry_ops_2d);--> statement-breakpoint
CREATE INDEX "idx_paths_route" ON "paths" USING gist ("route" gist_geometry_ops_2d);

-- === Seed Rovers ===
INSERT INTO rovers (name, ip_address)
VALUES
  ('Curiosity', '192.168.1.10'),
  ('Perseverance', '192.168.1.11')
RETURNING id;

-- === Seed Paths ===
-- Use ST_GeomFromText for the LINESTRING (SRID 4326)
INSERT INTO paths (rover_id, route)
VALUES
  (1, ST_GeomFromText('LINESTRING(-73.57 45.50, -73.58 45.51)', 4326)),
  (2, ST_GeomFromText('LINESTRING(-73.55 45.49, -73.54 45.48)', 4326))
RETURNING id;

-- === Seed Images ===
-- Example point geometry (SRID 4326)
INSERT INTO images (path_id, image_url, location)
VALUES
  (1, 'uploads/image1.jpg', ST_SetSRID(ST_Point(-73.57, 45.50), 4326)),
  (2, 'uploads/image2.jpg', ST_SetSRID(ST_Point(-73.55, 45.49), 4326))
RETURNING id;

-- === Seed Detections ===
INSERT INTO detections (image_id, bbox, confidence, area_score, depth_score)
VALUES
(1, '[10, 20, 100, 80]', 0.92, 0.85, 0.73),
(1, '[50, 60, 40, 30]', 0.88, 0.65, 0.70),
(2, '[15, 25, 90, 70]', 0.95, 0.90, 0.80),
(2, '[60, 70, 30, 25]', 0.89, 0.60, 0.66);

-- === Seed User and Session ===
INSERT INTO "user" (id, username, password_hash)
VALUES
  ('user-1', 'testuser', '$2b$10$examplehash');

INSERT INTO session (id, user_id, expires_at)
VALUES
  ('session-1', 'user-1', now() + interval '7 days');
