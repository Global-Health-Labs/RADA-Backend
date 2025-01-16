CREATE TABLE IF NOT EXISTS "assay_plate_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"assay_plate_prefix" varchar(50) NOT NULL,
	"num_plates" integer NOT NULL,
	"num_strips" integer NOT NULL,
	"num_columns" integer NOT NULL,
	"locations" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lfa_experiment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"num_replicates" integer NOT NULL,
	"plate_config_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lfa_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid,
	"step" varchar(100) NOT NULL,
	"dx" real NOT NULL,
	"dz" real NOT NULL,
	"volume" real NOT NULL,
	"liquid_class" varchar(50) NOT NULL,
	"time" real NOT NULL,
	"source" varchar(100) NOT NULL,
	"order_index" integer NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lfa_experiment" ADD CONSTRAINT "lfa_experiment_plate_config_id_assay_plate_config_id_fk" FOREIGN KEY ("plate_config_id") REFERENCES "assay_plate_config"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lfa_experiment" ADD CONSTRAINT "lfa_experiment_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lfa_step" ADD CONSTRAINT "lfa_step_experiment_id_lfa_experiment_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "lfa_experiment"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
