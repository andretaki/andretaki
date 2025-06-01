-- Migration script to update embedding dimensions from 1536 to 768
-- Run this script to migrate to text-embedding-004 (768 dimensions)

-- First, ensure the vector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Update the proposed_topics table
ALTER TABLE marketing.proposed_topics 
ALTER COLUMN topic_embedding TYPE vector(768);

-- Update the chunks table in rag_system
ALTER TABLE rag_system.chunks 
ALTER COLUMN content_embedding TYPE vector(768);

-- Drop and recreate any pgvector indexes that may be affected by the dimension change
-- (You may need to adjust these based on your specific indexes)

-- For proposed_topics table (if you have any vector indexes)
-- DROP INDEX IF EXISTS marketing.idx_proposed_topics_embedding;
-- CREATE INDEX idx_proposed_topics_embedding ON marketing.proposed_topics 
-- USING ivfflat (topic_embedding vector_cosine_ops) WITH (lists = 100);

-- For chunks table (if you have any vector indexes)
-- DROP INDEX IF EXISTS rag_system.idx_chunks_embedding;
-- CREATE INDEX idx_chunks_embedding ON rag_system.chunks 
-- USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 100);

-- Note: After running this migration, you'll need to re-generate all embeddings
-- since the old 1536-dimensional embeddings are incompatible with the new 768-dimensional model

-- Clear existing embeddings (they will be regenerated with the new model)
UPDATE marketing.proposed_topics SET topic_embedding = NULL;
UPDATE rag_system.chunks SET content_embedding = NULL; 