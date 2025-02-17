CREATE TABLE IF NOT EXISTS "naat_preset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "naat_liquid_type" ALTER COLUMN "needs_tip_washing" SET DEFAULT false;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "naat_preset" ADD CONSTRAINT "naat_preset_experiment_id_experimental_plan_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "experimental_plan"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "naat_preset" ADD CONSTRAINT "naat_preset_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
