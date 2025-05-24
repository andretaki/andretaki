# RAG Embedding Upgrade Guide: From ada-002 to OpenAI "003" Models

## Overview

This guide helps you upgrade your RAG (Retrieval-Augmented Generation) system from the older `text-embedding-ada-002` model to the newer and more powerful `text-embedding-3-small` or `text-embedding-3-large` models.

## Key Differences Between Models

### text-embedding-ada-002 (Legacy)
- **Dimensions**: 1536 (fixed)
- **Performance**: Baseline
- **Cost**: $0.0001 per 1K tokens
- **Use case**: Legacy applications

### text-embedding-3-small (Recommended)
- **Dimensions**: 1536 (default), can be reduced to 512 or 1024
- **Performance**: ~50% better than ada-002
- **Cost**: $0.00002 per 1K tokens (5x cheaper than ada-002!)
- **Use case**: Most applications, great cost/performance ratio

### text-embedding-3-large (High Performance)
- **Dimensions**: 3072 (default), can be reduced to 256, 1024, 1536, 2048
- **Performance**: Best available from OpenAI
- **Cost**: $0.00013 per 1K tokens
- **Use case**: Applications requiring maximum retrieval accuracy

## Decision Matrix

| Factor | text-embedding-3-small | text-embedding-3-large |
|--------|------------------------|------------------------|
| **Cost** | ✅ Very Low | ⚠️ Higher |
| **Performance** | ✅ Good | ✅ Excellent |
| **Storage** | ✅ Moderate (1536D) | ⚠️ Large (3072D) |
| **Speed** | ✅ Fast | ⚠️ Slower |
| **Recommendation** | Most use cases | High-accuracy requirements |

## Migration Scenarios

### Scenario 1: ada-002 → text-embedding-3-small (Same Dimensions)
- **Current**: ada-002 (1536D)
- **Target**: text-embedding-3-small (1536D default)
- **Database changes**: None required
- **Re-embedding**: Required (different model)
- **Benefits**: 5x cost reduction, ~50% better performance

### Scenario 2: ada-002 → text-embedding-3-large
- **Current**: ada-002 (1536D)
- **Target**: text-embedding-3-large (3072D default)
- **Database changes**: Alter column to `VECTOR(3072)`
- **Re-embedding**: Required
- **Benefits**: Best performance, but higher cost and storage

### Scenario 3: Dimension Optimization
- **Current**: Any model (1536D)
- **Target**: text-embedding-3-small (512D or 1024D)
- **Database changes**: Alter column to `VECTOR(512)` or `VECTOR(1024)`
- **Re-embedding**: Required
- **Benefits**: Reduced storage, faster queries, often minimal performance loss

## Step-by-Step Migration Process

### 1. Assess Current State

First, check your current embedding setup:

```sql
-- Check current vector column dimension
\d rag_system.chunks

-- Count total chunks to migrate
SELECT COUNT(*) FROM rag_system.chunks;

-- Check average content length (for cost estimation)
SELECT AVG(LENGTH(content)) FROM rag_system.chunks;
```

### 2. Choose Target Model and Dimensions

Update the configuration in `scripts/migrate-embeddings.ts`:

```typescript
const MIGRATION_CONFIG = {
  currentModel: 'text-embedding-ada-002',
  
  // Option A: Same dimensions, better performance, much lower cost
  targetModel: 'text-embedding-3-small', // Default 1536D
  targetDimensions: undefined,
  
  // Option B: Higher performance with more dimensions
  // targetModel: 'text-embedding-3-large', // Default 3072D
  // targetDimensions: undefined,
  
  // Option C: Optimize for storage and speed
  // targetModel: 'text-embedding-3-small',
  // targetDimensions: 512, // or 1024
};
```

### 3. Estimate Migration Cost

Run the cost estimation:

```bash
npx tsx scripts/migrate-embeddings.ts
```

This will show:
- Total chunks to migrate
- Estimated tokens
- Estimated cost
- Whether database schema changes are needed

### 4. Update Your RAG Query API

Update `app/api/rag/query/route.ts` to match your chosen model:

```typescript
// Match this to your migration target
const EMBEDDING_MODEL = 'text-embedding-3-small';
// const EMBEDDING_DIMENSIONS = 512; // Only if using custom dimensions
```

### 5. Run the Migration

The migration script will:
1. Check if migration is needed
2. Update database schema if dimensions changed
3. Re-embed all chunks with the new model
4. Update the database with new embeddings

```bash
# Dry run (estimation only)
npx tsx scripts/migrate-embeddings.ts

# If you're ready to proceed, the script will handle everything
```

### 6. Update Your Document Ingestion Pipeline

Ensure any code that processes new documents uses the same model:

```typescript
// In your document processing code
const embeddingParams: OpenAI.Embeddings.EmbeddingCreateParams = {
  model: 'text-embedding-3-small', // Match your migration target
  input: chunkContent,
  // dimensions: 512, // Only if using custom dimensions
};
```

## Important Considerations

### 🚨 Critical Requirements

1. **Consistency**: Query embeddings and document embeddings MUST use the same model and dimensions
2. **Complete Re-embedding**: You cannot mix embeddings from different models in the same system
3. **Backup**: Consider backing up your current embeddings before migration

### 💰 Cost Optimization Tips

1. **Start with text-embedding-3-small**: 5x cheaper than ada-002, significant performance improvement
2. **Test reduced dimensions**: Try 512 or 1024 dimensions - often minimal performance loss
3. **Batch processing**: The migration script includes rate limiting and batching

### 🏃‍♂️ Performance Optimization

1. **Smaller dimensions = faster queries**: Consider reducing from 1536 to 512/1024
2. **Index optimization**: Ensure your vector column has proper indexing
3. **Connection pooling**: Use connection pooling for better database performance

## Testing and Validation

### 1. Test Query Performance

After migration, test with sample queries:

```typescript
// Test your RAG API
const response = await fetch('/api/rag/query', {
  method: 'POST',
  body: JSON.stringify({
    query: 'Your test query',
    topK: 5,
    minConfidence: 70
  })
});
```

### 2. Compare Results

Compare retrieval quality before and after migration:
- Are relevant documents still being found?
- Are similarity scores reasonable?
- Is response time acceptable?

### 3. Monitor Costs

Track your OpenAI usage:
- Embedding API calls
- Total token usage
- Cost per query

## Rollback Plan

If you need to rollback:

1. **Database backup**: Restore from backup if you have one
2. **Re-migration**: Run the migration script with the old model settings
3. **API updates**: Revert your API code to use the old model

## Common Issues and Solutions

### Issue: Dimension Mismatch Error
```
ERROR: vector dimension mismatch
```
**Solution**: Ensure your database column dimensions match your embedding model output dimensions.

### Issue: Query Performance Degradation
**Solution**: 
- Check your vector index
- Consider reducing dimensions
- Verify your database connection pooling

### Issue: High Migration Cost
**Solution**:
- Start with text-embedding-3-small (much cheaper)
- Consider reducing dimensions
- Process in smaller batches

## Example Configurations

### Configuration 1: Cost-Optimized
```typescript
{
  currentModel: 'text-embedding-ada-002',
  targetModel: 'text-embedding-3-small',
  targetDimensions: 512, // Reduce storage and cost
}
```

### Configuration 2: Performance-Optimized
```typescript
{
  currentModel: 'text-embedding-ada-002',
  targetModel: 'text-embedding-3-large',
  targetDimensions: undefined, // Use default 3072 dimensions
}
```

### Configuration 3: Balanced
```typescript
{
  currentModel: 'text-embedding-ada-002',
  targetModel: 'text-embedding-3-small',
  targetDimensions: undefined, // Keep 1536 dimensions
}
```

## Next Steps

1. Review your current RAG system performance and costs
2. Choose your target model based on your requirements
3. Run the cost estimation
4. Plan a maintenance window for migration
5. Test thoroughly after migration
6. Monitor performance and costs post-migration

## Support

If you encounter issues during migration:
1. Check the migration script logs
2. Verify your OpenAI API key and quotas
3. Ensure database connectivity
4. Review the configuration for any typos

Remember: The migration is a one-time process, but the benefits (cost reduction, performance improvement) are ongoing! 