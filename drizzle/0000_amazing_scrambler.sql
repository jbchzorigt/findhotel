-- Нэрний ойролцоо ижилслийн индекс (gin_trgm_ops) үүнээс хамаарна.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."location_source" AS ENUM('OSM_POI', 'GPS', 'MAP_PIN', 'MAPS_LINK');--> statement-breakpoint
CREATE TYPE "public"."survey_status" AS ENUM('SUBMITTED', 'EXPORTED', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."surveyor_role" AS ENUM('SURVEYOR', 'ADMIN');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" varchar(64) NOT NULL,
	"subject_id" uuid,
	"ip" varchar(64),
	"user_agent" text,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_cache" (
	"grid_key" text PRIMARY KEY NOT NULL,
	"address_text" text,
	"poi" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hotel_survey" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_uuid" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"name_normalized" varchar(200) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"address_text" text,
	"lat" numeric(9, 6) NOT NULL,
	"lng" numeric(10, 6) NOT NULL,
	"location_source" "location_source" NOT NULL,
	"location_accuracy_m" integer,
	"osm_ref" text,
	"osm_raw_name" text,
	"google_maps_url" text,
	"note" text,
	"status" "survey_status" DEFAULT 'SUBMITTED' NOT NULL,
	"duplicate_ack" boolean DEFAULT false NOT NULL,
	"duplicate_of" uuid,
	"surveyor_id" uuid NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"exported_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hotel_survey_lat_range" CHECK ("hotel_survey"."lat" BETWEEN -90 AND 90),
	CONSTRAINT "hotel_survey_lng_range" CHECK ("hotel_survey"."lng" BETWEEN -180 AND 180),
	CONSTRAINT "hotel_survey_phone_format" CHECK ("hotel_survey"."phone" ~ '^[7-9][0-9]{7}$'),
	CONSTRAINT "hotel_survey_accuracy_sane" CHECK ("hotel_survey"."location_accuracy_m" IS NULL OR "hotel_survey"."location_accuracy_m" BETWEEN 0 AND 100000)
);
--> statement-breakpoint
CREATE TABLE "survey_photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"r2_key" text NOT NULL,
	"public_url" text NOT NULL,
	"sha256" char(64),
	"bytes" integer,
	"width" integer,
	"height" integer,
	"exif_lat" numeric(9, 6),
	"exif_lng" numeric(10, 6),
	"exif_taken_at" timestamp with time zone,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_photo_exif_lat_range" CHECK ("survey_photo"."exif_lat" IS NULL OR "survey_photo"."exif_lat" BETWEEN -90 AND 90),
	CONSTRAINT "survey_photo_exif_lng_range" CHECK ("survey_photo"."exif_lng" IS NULL OR "survey_photo"."exif_lng" BETWEEN -180 AND 180)
);
--> statement-breakpoint
CREATE TABLE "surveyor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"badge_number" varchar(32) NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"unit" varchar(120),
	"role" "surveyor_role" DEFAULT 'SURVEYOR' NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_surveyor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."surveyor"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_survey" ADD CONSTRAINT "hotel_survey_duplicate_of_hotel_survey_id_fk" FOREIGN KEY ("duplicate_of") REFERENCES "public"."hotel_survey"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_survey" ADD CONSTRAINT "hotel_survey_surveyor_id_surveyor_id_fk" FOREIGN KEY ("surveyor_id") REFERENCES "public"."surveyor"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_photo" ADD CONSTRAINT "survey_photo_survey_id_hotel_survey_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."hotel_survey"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_actor_created_idx" ON "audit_log" USING btree ("actor_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_subject_idx" ON "audit_log" USING btree ("subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hotel_survey_client_uuid_key" ON "hotel_survey" USING btree ("client_uuid");--> statement-breakpoint
CREATE INDEX "hotel_survey_status_created_idx" ON "hotel_survey" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "hotel_survey_surveyor_created_idx" ON "hotel_survey" USING btree ("surveyor_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "hotel_survey_lat_lng_idx" ON "hotel_survey" USING btree ("lat","lng");--> statement-breakpoint
CREATE INDEX "hotel_survey_osm_ref_idx" ON "hotel_survey" USING btree ("osm_ref") WHERE osm_ref IS NOT NULL;--> statement-breakpoint
CREATE INDEX "hotel_survey_name_trgm_idx" ON "hotel_survey" USING gin ("name_normalized" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "survey_photo_survey_idx" ON "survey_photo" USING btree ("survey_id");--> statement-breakpoint
CREATE UNIQUE INDEX "surveyor_badge_number_key" ON "surveyor" USING btree ("badge_number");