-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- -------------------
-- Rovers Table
-- -------------------
CREATE TABLE "rovers" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar(100) NOT NULL,
    "status" varchar(50) DEFAULT 'active' NOT NULL,
    "ip_address" inet NOT NULL
);

-- -------------------
-- Paths Table
-- -------------------
CREATE TABLE "paths" (
    "id" serial PRIMARY KEY NOT NULL,
    "rover_id" integer NOT NULL,
    "route" geometry(LINESTRING, 4326) NOT NULL, -- Series of connected points
    "timestamp" timestamp with time zone DEFAULT now(),
    CONSTRAINT "paths_rover_id_rovers_id_fk" FOREIGN KEY ("rover_id") REFERENCES "rovers"("id") ON DELETE CASCADE
);

-- -------------------
-- Images Table
-- -------------------
CREATE TABLE "images" (
    "id" serial PRIMARY KEY NOT NULL,
    "path_id" integer NOT NULL,
    "image_url" text NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    "location" geometry(POINT, 4326) NOT NULL,
    CONSTRAINT "images_path_id_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "paths"("id") ON DELETE CASCADE
);

-- -------------------
-- Detections Table
-- -------------------
CREATE TABLE "detections" (
    "id" serial PRIMARY KEY NOT NULL,
    "image_id" integer NOT NULL,
    "bbox" jsonb NOT NULL, -- Store as JSON array [x_min, y_min, x_max, y_max]
    "confidence" integer NOT NULL,
    "area_score" integer,
    "depth_score" integer,
    "false_positive" integer DEFAULT 0,
    CONSTRAINT "detections_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "images"("id") ON DELETE CASCADE
);

-- -------------------
-- User Authentication Tables
-- -------------------
CREATE TABLE "user" (
    "id" text PRIMARY KEY NOT NULL,
    "username" text NOT NULL UNIQUE,
    "password_hash" text NOT NULL
);

CREATE TABLE "session" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

-- -------------------
-- Spatial Indexes
-- -------------------
CREATE INDEX idx_paths_route ON "paths" USING GIST (route);
CREATE INDEX idx_images_location ON "images" USING GIST (location);

-- -------------------
-- Sample Data
-- -------------------
INSERT INTO "rovers" (id, name, status, ip_address) VALUES
    (1, 'Main Rover', 'active', '100.85.202.20'),
    (2, 'Standby Rover', 'inactive', '100.85.202.21');

INSERT INTO "paths" (id, rover_id, route, timestamp) VALUES
    (1, 1, ST_GeomFromText('LINESTRING(-73.9857 40.7484, -73.9853 40.7486, -73.9850 40.7490)', 4326), NOW()),
    (2, 2, ST_GeomFromText('LINESTRING(-118.2437 34.0522, -118.2440 34.0515, -118.2443 34.0510)', 4326), NOW());

-- Example: Insert sample images
-- INSERT INTO "images" (id, path_id, image_url, location) VALUES
--     (1, 1, '/path/to/image1.jpg', ST_GeomFromText('POINT(-73.9855 40.7485)', 4326)),
--     (2, 1, '/path/to/image2.jpg', ST_GeomFromText('POINT(-73.9854 40.7486)', 4326));

-- Example: Insert sample detections
-- INSERT INTO "detections" (image_id, bbox, confidence, area_score, depth_score, false_positive) VALUES
--     (1, '[10, 20, 50, 80]', 95, 120, 5, 0),
--     (1, '[30, 40, 60, 90]', 88, 100, 3, 0),
--     (2, '[15, 25, 55, 85]', 92, 110, 4, 1);
