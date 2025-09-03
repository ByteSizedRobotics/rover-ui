-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create rovers table
CREATE TABLE "rovers" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar(100) NOT NULL,
    "status" varchar(50) DEFAULT 'active' NOT NULL,
    "ip_address" inet NOT NULL
);

-- Create paths table with LINESTRING for detailed routes
CREATE TABLE "paths" (
    "id" serial PRIMARY KEY NOT NULL,
    "rover_id" integer NOT NULL,
    "route" geometry(LINESTRING, 4326) NOT NULL, -- Stores the path as a series of connected points
    "timestamp" timestamp with time zone DEFAULT now(),
    CONSTRAINT "paths_rover_id_rovers_id_fk" FOREIGN KEY ("rover_id") REFERENCES "rovers"("id") ON DELETE CASCADE
);

-- Create potholes table with PostGIS geometry type
CREATE TABLE "potholes" (
    "id" serial PRIMARY KEY NOT NULL,
    "path_id" integer NOT NULL,
    "location" geometry(POINT, 4326) NOT NULL, -- Still a POINT since potholes are single locations
    "severity" integer NOT NULL,
    "image_url" text NOT NULL,
    CONSTRAINT "potholes_path_id_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "paths"("id") ON DELETE CASCADE
);

-- Create user table
CREATE TABLE "user" (
    "id" text PRIMARY KEY NOT NULL,
    "username" text NOT NULL,
    "password_hash" text NOT NULL,
    CONSTRAINT "user_username_unique" UNIQUE("username")
);

-- Create session table
CREATE TABLE "session" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

-- Create spatial indexes for faster geospatial queries
CREATE INDEX idx_paths_route ON "paths" USING GIST (route);
CREATE INDEX idx_potholes_location ON "potholes" USING GIST (location);

-- Insert sample rovers
INSERT INTO "rovers" (id, name, status, ip_address) VALUES
    (1, 'Main Rover', 'active', '100.85.202.20'),
    (2, 'Standby Rover', 'inactive', '100.85.202.21');

-- Insert sample paths with LINESTRING (series of points representing a path)
INSERT INTO "paths" (id, rover_id, route, timestamp) VALUES
    (1, 1, ST_GeomFromText('LINESTRING(-73.9857 40.7484, -73.9853 40.7486, -73.9850 40.7490)', 4326), NOW()),
    (2, 2, ST_GeomFromText('LINESTRING(-118.2437 34.0522, -118.2440 34.0515, -118.2443 34.0510)', 4326), NOW());

-- Insert sample potholes with POINT (single location)
INSERT INTO "potholes" (id, path_id, location, severity, image_url) VALUES
    (1, 1, ST_GeomFromText('POINT(-73.9855 40.7485)', 4326), 3, 'https://example.com/pothole1.jpg'),
    (2, 1, ST_GeomFromText('POINT(-73.9854 40.7486)', 4326), 5, 'https://example.com/pothole2.jpg'),
    (3, 2, ST_GeomFromText('POINT(-118.2438 34.0520)', 4326), 2, 'https://example.com/pothole3.jpg');
