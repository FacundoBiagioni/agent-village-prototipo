CREATE TYPE "public"."template_status" AS ENUM('pending', 'approved', 'discarded');--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"niche" text NOT NULL,
	"aesthetic" text NOT NULL,
	"format" text NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fonts" text,
	"css" text NOT NULL,
	"pages" jsonb NOT NULL,
	"status" "template_status" DEFAULT 'pending' NOT NULL,
	"note" text,
	"run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "templates_niche_status_index" ON "templates" USING btree ("niche","status");