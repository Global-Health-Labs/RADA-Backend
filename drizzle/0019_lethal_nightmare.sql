CREATE TABLE IF NOT EXISTS "experiment_file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"experiment_type" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"s3_key" varchar(512) NOT NULL,
	"content_type" varchar(100),
	"file_size" integer,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DROP TABLE "document";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "experiment_file" ADD CONSTRAINT "experiment_file_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
