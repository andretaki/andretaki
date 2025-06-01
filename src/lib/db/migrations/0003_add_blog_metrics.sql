-- Add views and engagement to blog_posts
ALTER TABLE "marketing"."blog_posts" ADD COLUMN "views" integer;
ALTER TABLE "marketing"."blog_posts" ADD COLUMN "engagement" integer; -- e.g., a score from 0-100 