CREATE TABLE IF NOT EXISTS "liquid_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"value" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_updated_by" uuid NOT NULL,
	CONSTRAINT "liquid_type_value_unique" UNIQUE("value")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "liquid_type" ADD CONSTRAINT "liquid_type_last_updated_by_user_id_fk" FOREIGN KEY ("last_updated_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
