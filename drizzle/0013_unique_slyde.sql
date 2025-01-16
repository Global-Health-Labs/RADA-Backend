ALTER TABLE "reagent_plate" RENAME TO "lfa_reagent_plate";--> statement-breakpoint
ALTER TABLE "lfa_reagent_plate" DROP CONSTRAINT "reagent_plate_plate_unique";--> statement-breakpoint
ALTER TABLE "lfa_reagent_plate" DROP CONSTRAINT "reagent_plate_last_updated_by_user_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lfa_reagent_plate" ADD CONSTRAINT "lfa_reagent_plate_last_updated_by_user_id_fk" FOREIGN KEY ("last_updated_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "lfa_reagent_plate" ADD CONSTRAINT "lfa_reagent_plate_plate_unique" UNIQUE("plate");