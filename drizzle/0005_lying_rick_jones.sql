CREATE TYPE "public"."visit_result" AS ENUM('interested', 'come_back', 'not_interested');--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"lead_id" uuid NOT NULL,
	"demo_id" uuid,
	"result" "visit_result" NOT NULL,
	"note" text,
	"come_back_on" date,
	"do_not_contact" boolean DEFAULT false NOT NULL,
	"visited_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visits_clientId_unique" UNIQUE("client_id")
);
--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_demo_id_demos_id_fk" FOREIGN KEY ("demo_id") REFERENCES "public"."demos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visits_lead_id_visited_at_index" ON "visits" USING btree ("lead_id","visited_at");