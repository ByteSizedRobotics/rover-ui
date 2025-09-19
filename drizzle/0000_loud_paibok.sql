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
ALTER TABLE "paths" ADD CONSTRAINT "paths_rover_id_rovers_id_fk" FOREIGN KEY ("rover_id") REFERENCES "public"."rovers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_images_location" ON "images" USING gist ("location" gist_geometry_ops_2d);--> statement-breakpoint
CREATE INDEX "idx_paths_route" ON "paths" USING gist ("route" gist_geometry_ops_2d);