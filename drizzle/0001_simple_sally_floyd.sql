CREATE TYPE "public"."lead_stage" AS ENUM('found', 'analyzed', 'demo_created', 'contacted', 'replied', 'closed', 'paying', 'hosted', 'lost', 'do_not_contact');--> statement-breakpoint
CREATE TYPE "public"."web_status" AS ENUM('none', 'social_only', 'unchecked', 'ok', 'outdated', 'down');--> statement-breakpoint
CREATE TABLE "do_not_contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"name" text,
	"phone" text,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_id" text,
	"name" text NOT NULL,
	"niche" text,
	"category" text,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"address" text,
	"phone" text,
	"websites" text[] DEFAULT '{}' NOT NULL,
	"socials" text[] DEFAULT '{}' NOT NULL,
	"web_status" "web_status" NOT NULL,
	"web_score" integer,
	"web_signals" jsonb,
	"web_checked_at" timestamp with time zone,
	"confidence" real,
	"sources_count" integer DEFAULT 1 NOT NULL,
	"stage" "lead_stage" DEFAULT 'found' NOT NULL,
	"lost_reason" text,
	"notes" text,
	"seen_in_release" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"niche" text NOT NULL,
	"center_lat" double precision NOT NULL,
	"center_lng" double precision NOT NULL,
	"radius_km" real NOT NULL,
	"results" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "do_not_contact" ADD CONSTRAINT "do_not_contact_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "leads_source_source_id_index" ON "leads" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "leads_niche_lat_lng_index" ON "leads" USING btree ("niche","lat","lng");