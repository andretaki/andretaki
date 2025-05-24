import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { OpenAI } from 'openai';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Choose ONE of these and ensure your stored embeddings match:
// const EMBEDDING_MODEL = 'text-embedding-3-small'; // Higher performance, lower cost than ada-002, 1536 dimensions by default
const EMBEDDING_MODEL = 'text-embedding-3-large';  // Highest performance, more expensive, 3072 dimensions by default

// OR if you are specifically requesting a different dimension for -small or -large:
// const EMBEDDING_MODEL_FOR_API_CALL = 'text-embedding-3-small'; // or -large
// const EMBEDDING_DIMENSIONS = 512; // or 1024, or 1536 for small; or 1024, 2048, 3072 for large

export async function POST(request: NextRequest) {
  try {
    const { query, topK = 5, minConfidence = 70 } = await request.json();
    if (!query) return NextResponse.json({ error: 'Query is required' }, { status: 400 });

    const embeddingParams: OpenAI.Embeddings.EmbeddingCreateParams = {
      model: EMBEDDING_MODEL, // Or EMBEDDING_MODEL_FOR_API_CALL
      input: query,
      // dimensions: EMBEDDING_DIMENSIONS // Only include if you are using custom dimensions
    };

    const embeddingResponse = await openai.embeddings.create(embeddingParams);
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Ensure your `content_embedding` column in `rag_system.chunks` matches the dimension
    // of the embeddings you are generating (e.g., VECTOR(1536) for default text-embedding-3-small,
    // or VECTOR(3072) for default text-embedding-3-large, or VECTOR(your_custom_dimension)).
    const dbQuery = `
      SELECT 
        c.id, 
        c.content, 
        c.metadata,
        c.document_id,
        d.name as document_name,
        c.confidence_score,
        1 - (c.content_embedding <=> $1::vector) AS similarity
      FROM rag_system.chunks c
      JOIN rag_system.documents d ON c.document_id = d.id
      WHERE c.confidence_score >= $3
      ORDER BY similarity DESC
      LIMIT $2;
    `;
    
    const { rows: chunks } = await pool.query(dbQuery, [queryEmbedding, topK, minConfidence]);
    return NextResponse.json({ chunks });
  } catch (error: any) {
    console.error('RAG Query API Error:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid request parameters', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Failed to query RAG' }, { status: 500 });
  }
} 