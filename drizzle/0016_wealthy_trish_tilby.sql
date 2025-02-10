CREATE TABLE IF NOT EXISTS "lfa_deck_layout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"plate_positions" jsonb NOT NULL,
	"assay_plate_config_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" uuid,
	CONSTRAINT "lfa_deck_layout_name_unique" UNIQUE("name")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lfa_deck_layout" ADD CONSTRAINT "lfa_deck_layout_assay_plate_config_id_assay_plate_config_id_fk" FOREIGN KEY ("assay_plate_config_id") REFERENCES "assay_plate_config"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lfa_deck_layout" ADD CONSTRAINT "lfa_deck_layout_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
