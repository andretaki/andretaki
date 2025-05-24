-- Create RAG System Schema
CREATE SCHEMA IF NOT EXISTS rag_system;

-- Create Documents Table
CREATE TABLE rag_system.documents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create Chunks Table with Vector Support
CREATE TABLE rag_system.chunks (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES rag_system.documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_embedding vector(1536) NOT NULL, -- OpenAI ada-002 embedding dimension
    metadata JSONB,
    confidence_score DECIMAL(5,2) DEFAULT 1.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create Indexes
CREATE INDEX chunks_document_id_idx ON rag_system.chunks(document_id);
CREATE INDEX chunks_content_embedding_idx ON rag_system.chunks USING ivfflat (content_embedding vector_cosine_ops);

-- Set Ownership
ALTER TABLE rag_system.documents OWNER TO "default";
ALTER TABLE rag_system.chunks OWNER TO "default";

-- Add Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON rag_system.documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chunks_updated_at
    BEFORE UPDATE ON rag_system.chunks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 