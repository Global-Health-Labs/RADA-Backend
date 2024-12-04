CREATE TABLE IF NOT EXISTS "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_plan_id" uuid,
	"original_file_name" varchar(255) NOT NULL,
	"secure_file_name" varchar(255) NOT NULL,
	"s3_url" varchar(255) NOT NULL,
	"content_type" varchar(50),
	"file_size" integer,
	"file_hash" varchar(64),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "experimental_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_of_experimental_plan" varchar(255),
	"num_of_sample_concentrations" integer,
	"num_of_technical_replicates" integer,
	"mastermix_volume_per_reaction" integer,
	"sample_volume_per_reaction" integer,
	"pcr_plate_size" integer,
	"owner_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master_mix_recipe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_index" integer,
	"mastermix_id" uuid,
	"final_source" varchar(50),
	"unit" varchar(50),
	"final_concentration" real,
	"tip_washing" varchar(50),
	"stock_concentration" real,
	"liquid_type" varchar(50),
	"dispense_type" varchar(50),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master_mix" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_of_mastermix" varchar(50) NOT NULL,
	"experimental_plan_id" uuid,
	"order_index" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	CONSTRAINT "role_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fullname" varchar(50) NOT NULL,
	"email" varchar(50) NOT NULL,
	"password" varchar(256),
	"role_id" uuid,
	"role_updated_at" timestamp DEFAULT now(),
	"confirmed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document" ADD CONSTRAINT "document_experiment_plan_id_experimental_plan_id_fk" FOREIGN KEY ("experiment_plan_id") REFERENCES "experimental_plan"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "experimental_plan" ADD CONSTRAINT "experimental_plan_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_mix_recipe" ADD CONSTRAINT "master_mix_recipe_mastermix_id_master_mix_id_fk" FOREIGN KEY ("mastermix_id") REFERENCES "master_mix"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_mix" ADD CONSTRAINT "master_mix_experimental_plan_id_experimental_plan_id_fk" FOREIGN KEY ("experimental_plan_id") REFERENCES "experimental_plan"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user" ADD CONSTRAINT "user_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
