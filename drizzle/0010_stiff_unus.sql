CREATE TABLE IF NOT EXISTS "lfa_liquid_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"value" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_updated_by" uuid NOT NULL,
	CONSTRAINT "lfa_liquid_type_value_unique" UNIQUE("value")
);
--> statement-breakpoint
ALTER TABLE "liquid_type" RENAME TO "naat_liquid_type";--> statement-breakpoint
ALTER TABLE "naat_liquid_type" DROP CONSTRAINT "liquid_type_value_unique";--> statement-breakpoint
ALTER TABLE "naat_liquid_type" DROP CONSTRAINT "liquid_type_last_updated_by_user_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "naat_liquid_type" ADD CONSTRAINT "naat_liquid_type_last_updated_by_user_id_fk" FOREIGN KEY ("last_updated_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lfa_liquid_type" ADD CONSTRAINT "lfa_liquid_type_last_updated_by_user_id_fk" FOREIGN KEY ("last_updated_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "naat_liquid_type" ADD CONSTRAINT "naat_liquid_type_value_unique" UNIQUE("value");