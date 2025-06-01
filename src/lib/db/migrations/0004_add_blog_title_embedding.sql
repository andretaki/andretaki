ALTER TABLE "marketing"."blog_posts"
ADD COLUMN "title_embedding" vector(768);

-- Note: We'll create the index after backfilling the data
-- CREATE INDEX IF NOT EXISTS "idx_blog_posts_title_embedding_cosine" 
-- ON "marketing"."blog_posts" USING ivfflat (title_embedding vector_cosine_ops) WITH (lists = 100); 