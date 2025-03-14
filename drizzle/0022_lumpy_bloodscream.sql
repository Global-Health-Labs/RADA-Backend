ALTER TABLE "lfa_deck_layout" DROP CONSTRAINT "lfa_deck_layout_assay_plate_config_id_assay_plate_config_id_fk";
--> statement-breakpoint
ALTER TABLE "lfa_experiment" ADD COLUMN "assay_plate_config_id" uuid NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lfa_experiment" ADD CONSTRAINT "lfa_experiment_assay_plate_config_id_assay_plate_config_id_fk" FOREIGN KEY ("assay_plate_config_id") REFERENCES "assay_plate_config"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "lfa_deck_layout" DROP COLUMN IF EXISTS "assay_plate_config_id";