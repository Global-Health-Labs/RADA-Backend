ALTER TABLE "lfa_experiment" DROP CONSTRAINT "lfa_experiment_plate_config_id_assay_plate_config_id_fk";
--> statement-breakpoint
ALTER TABLE "lfa_experiment" ADD COLUMN "deck_layout_id" uuid NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lfa_experiment" ADD CONSTRAINT "lfa_experiment_deck_layout_id_lfa_deck_layout_id_fk" FOREIGN KEY ("deck_layout_id") REFERENCES "lfa_deck_layout"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "lfa_experiment" DROP COLUMN IF EXISTS "plate_config_id";