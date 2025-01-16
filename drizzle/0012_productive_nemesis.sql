ALTER TABLE "deck_layout" RENAME TO "naat_deck_layout";--> statement-breakpoint
ALTER TABLE "volume_unit" RENAME TO "naat_volume_unit";--> statement-breakpoint
ALTER TABLE "naat_deck_layout" DROP CONSTRAINT "deck_layout_name_unique";--> statement-breakpoint
ALTER TABLE "naat_volume_unit" DROP CONSTRAINT "volume_unit_unit_unique";--> statement-breakpoint
ALTER TABLE "experimental_plan" DROP CONSTRAINT "experimental_plan_deck_layout_id_deck_layout_id_fk";
--> statement-breakpoint
ALTER TABLE "naat_deck_layout" DROP CONSTRAINT "deck_layout_created_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "naat_volume_unit" DROP CONSTRAINT "volume_unit_last_updated_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "reagent_plate" ALTER COLUMN "plate" SET DATA TYPE varchar(255);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "experimental_plan" ADD CONSTRAINT "experimental_plan_deck_layout_id_naat_deck_layout_id_fk" FOREIGN KEY ("deck_layout_id") REFERENCES "naat_deck_layout"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "naat_deck_layout" ADD CONSTRAINT "naat_deck_layout_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "naat_volume_unit" ADD CONSTRAINT "naat_volume_unit_last_updated_by_user_id_fk" FOREIGN KEY ("last_updated_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "naat_deck_layout" ADD CONSTRAINT "naat_deck_layout_name_unique" UNIQUE("name");--> statement-breakpoint
ALTER TABLE "naat_volume_unit" ADD CONSTRAINT "naat_volume_unit_unit_unique" UNIQUE("unit");