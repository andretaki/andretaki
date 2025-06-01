# Google Gemini Embedding Setup

This project uses Google's Gemini `text-embedding-004` model for generating semantic embeddings for topic de-duplication and similarity search.

## Prerequisites

1. **Google AI API Key**: You need a Google AI API key with access to the Generative Language API.
2. **PostgreSQL with pgvector**: Your database must have the `vector` extension enabled.

## Configuration

### Environment Variables

Set one of the following environment variables in your `.env` file:

```bash
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
# OR
GOOGLE_AI_API=your_google_ai_api_key_here
```

**⚠️ Important**: Never commit your API key to Git. Always use environment variables.

### Database Setup

1. **Enable pgvector extension**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **Run the migration script** (if migrating from OpenAI embeddings):
   ```bash
   psql -d your_database -f scripts/migrate-embeddings.sql
   ```

## Model Details

- **Model**: `text-embedding-004`
- **Dimensions**: 768
- **Task Types**:
  - `RETRIEVAL_DOCUMENT`: For indexing documents/content
  - `SEMANTIC_SIMILARITY`: For comparing similar texts (used for de-duplication)

## Usage

### Generating Embeddings

```typescript
import { generateGeminiEmbedding } from '../lib/ai/embedding-client';
import { TaskType } from '@google/generative-ai';

// For document indexing
const embedding = await generateGeminiEmbedding(
  "Your text here", 
  TaskType.RETRIEVAL_DOCUMENT
);

// For semantic similarity comparison
const embedding = await generateGeminiEmbedding(
  "Your text here", 
  TaskType.SEMANTIC_SIMILARITY
);
```

### Similarity Search

```typescript
import { findSimilarTopicsWithPgVector } from '../lib/ai/embedding-client';

const similarTopics = await findSimilarTopicsWithPgVector(
  db,           // Drizzle client
  embedding,    // Query embedding
  0.80,         // Similarity threshold (0-1)
  5,            // Max results
  excludeId     // Optional: exclude specific ID
);
```

## Testing

Run the embedding test script to verify everything works:

```bash
tsx scripts/test-embeddings.ts
```

This will:
- Test embedding generation with different task types
- Verify correct dimensions (768)
- Test semantic similarity calculation
- Display sample embedding values

## Similarity Thresholds

The similarity search uses cosine similarity with these recommended thresholds:

- **0.90+**: Very similar (likely duplicates)
- **0.80-0.89**: Similar topics
- **0.70-0.79**: Somewhat related
- **< 0.70**: Different topics

**Default threshold**: 0.80 (adjust based on your needs)

## Migration from OpenAI

If migrating from OpenAI's `text-embedding-ada-002` (1536 dimensions):

1. Run the migration script to update vector columns
2. All existing embeddings will be cleared (incompatible dimensions)
3. Re-generate embeddings using the new model
4. Update any hardcoded dimension references

## Troubleshooting

### Common Issues

1. **"vector extension not found"**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **Dimension mismatch errors**:
   - Ensure database columns use `vector(768)`
   - Clear old embeddings after migration

3. **API key errors**:
   - Verify `GOOGLE_AI_API_KEY` is set
   - Ensure the key has Generative Language API access
   - Check API quotas and billing

### Performance Tips

1. **Batch processing**: Generate embeddings in batches for better throughput
2. **Caching**: Cache embeddings to avoid regenerating for the same text
3. **Indexes**: Create pgvector indexes for large datasets:
   ```sql
   CREATE INDEX idx_topics_embedding ON marketing.proposed_topics 
   USING ivfflat (topic_embedding vector_cosine_ops) WITH (lists = 100);
   ```

## Cost Considerations

- Google's embedding models are generally cost-effective
- Monitor usage through the Google Cloud Console
- Consider caching strategies for frequently accessed embeddings
- Batch requests when possible to optimize API usage 