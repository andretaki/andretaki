CREATE TABLE IF NOT EXISTS "marketing"."proposed_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic_title" text NOT NULL,
	"topic_embedding" "vector(1536)",
	"primary_keyword" text,
	"secondary_keywords" jsonb,
	"source_type" varchar(50) NOT NULL,
	"source_identifier" text,
	"status" varchar(50) DEFAULT 'proposed' NOT NULL,
	"associated_product_db_id" integer,
	"content_pipeline_task_id" integer,
	"final_blog_post_id" integer,
	"rejection_reason" text,
	"notes" text,
	"search_volume" integer,
	"keyword_difficulty" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposed_topics_content_pipeline_task_id_unique" UNIQUE("content_pipeline_task_id"),
	CONSTRAINT "proposed_topics_final_blog_post_id_unique" UNIQUE("final_blog_post_id")
);
--> statement-breakpoint
ALTER TABLE "marketing"."blog_posts" ALTER COLUMN "type" SET DEFAULT 'standard_blog';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_proposed_topics_status" ON "marketing"."proposed_topics" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_proposed_topics_associated_product_db_id" ON "marketing"."proposed_topics" ("associated_product_db_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_topic_title_lower_idx" ON "marketing"."proposed_topics" ("lower("proposed_topics"."topic_title")");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_blog_posts_status" ON "marketing"."blog_posts" ("status");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketing"."proposed_topics" ADD CONSTRAINT "proposed_topics_associated_product_db_id_shopify_sync_products_id_fk" FOREIGN KEY ("associated_product_db_id") REFERENCES "rag_system"."shopify_sync_products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketing"."proposed_topics" ADD CONSTRAINT "proposed_topics_content_pipeline_task_id_content_pipeline_id_fk" FOREIGN KEY ("content_pipeline_task_id") REFERENCES "marketing"."content_pipeline"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketing"."proposed_topics" ADD CONSTRAINT "proposed_topics_final_blog_post_id_blog_posts_id_fk" FOREIGN KEY ("final_blog_post_id") REFERENCES "marketing"."blog_posts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
