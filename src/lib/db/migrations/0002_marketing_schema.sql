-- Create marketing schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS "marketing";

-- Create blog_posts table
CREATE TABLE IF NOT EXISTS "marketing"."blog_posts" (
    "id" serial PRIMARY KEY NOT NULL,
    "title" text NOT NULL,
    "content" text,
    "product_id" integer,
    "application_id" integer,
    "slug" text,
    "outline" jsonb,
    "status" varchar(50) DEFAULT 'draft',
    "meta_description" text,
    "keywords" jsonb,
    "word_count" integer,
    "type" varchar(50),
    "metadata" jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create product_applications table
CREATE TABLE IF NOT EXISTS "marketing"."product_applications" (
    "id" serial PRIMARY KEY NOT NULL,
    "product_id" integer NOT NULL,
    "application" text NOT NULL,
    "description" text,
    "target_audience" text,
    "market_potential" text,
    "technical_complexity" text,
    "industry" text,
    "use_case" text,
    "creativity" integer,
    "technical_details" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for blog_posts
CREATE INDEX IF NOT EXISTS "idx_blog_posts_product_id" ON "marketing"."blog_posts" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_blog_posts_application_id" ON "marketing"."blog_posts" ("application_id");
CREATE INDEX IF NOT EXISTS "idx_blog_posts_created_at" ON "marketing"."blog_posts" ("created_at");

-- Create indexes for product_applications
CREATE INDEX IF NOT EXISTS "idx_product_applications_product_id" ON "marketing"."product_applications" ("product_id");

-- Add foreign key constraints
ALTER TABLE "marketing"."blog_posts" 
    ADD CONSTRAINT "blog_posts_product_id_fk" 
    FOREIGN KEY ("product_id") 
    REFERENCES "rag_system"."shopify_sync_products"("id") 
    ON DELETE SET NULL;

ALTER TABLE "marketing"."blog_posts" 
    ADD CONSTRAINT "blog_posts_application_id_fk" 
    FOREIGN KEY ("application_id") 
    REFERENCES "marketing"."product_applications"("id") 
    ON DELETE SET NULL;

ALTER TABLE "marketing"."product_applications" 
    ADD CONSTRAINT "product_applications_product_id_fk" 
    FOREIGN KEY ("product_id") 
    REFERENCES "rag_system"."shopify_sync_products"("id") 
    ON DELETE CASCADE; 