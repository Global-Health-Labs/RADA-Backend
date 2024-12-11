CREATE TABLE IF NOT EXISTS "volume_unit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_updated_by" uuid NOT NULL,
	CONSTRAINT "volume_unit_unit_unique" UNIQUE("unit")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "volume_unit" ADD CONSTRAINT "volume_unit_last_updated_by_user_id_fk" FOREIGN KEY ("last_updated_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
