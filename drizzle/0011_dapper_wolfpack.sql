CREATE TABLE IF NOT EXISTS "reagent_plate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plate" varchar(100) NOT NULL,
	"volume_well" real NOT NULL,
	"num_rows" integer NOT NULL,
	"num_cols" integer NOT NULL,
	"volume_holdover" real NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_updated_by" uuid,
	CONSTRAINT "reagent_plate_plate_unique" UNIQUE("plate")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reagent_plate" ADD CONSTRAINT "reagent_plate_last_updated_by_user_id_fk" FOREIGN KEY ("last_updated_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
