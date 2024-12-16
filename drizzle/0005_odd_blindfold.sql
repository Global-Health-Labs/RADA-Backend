ALTER TABLE "experimental_plan" ADD COLUMN "deck_layout_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "experimental_plan" ADD CONSTRAINT "experimental_plan_deck_layout_id_deck_layout_id_fk" FOREIGN KEY ("deck_layout_id") REFERENCES "deck_layout"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
