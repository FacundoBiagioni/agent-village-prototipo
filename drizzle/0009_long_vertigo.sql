ALTER TABLE "clients" ADD COLUMN "domain" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "domain_renews_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "site_project" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "site_url" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "site_status" text DEFAULT 'none' NOT NULL;