import { Pool } from 'pg';
import { OpenAI } from 'openai';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configuration for embedding migration
const MIGRATION_CONFIG = {
  // Current embedding model in your database (what you're migrating FROM)
  currentModel: 'text-embedding-ada-002', // 1536 dimensions
  
  // Target embedding model (what you're migrating TO)
  targetModel: 'text-embedding-3-small', // Default: 1536 dimensions
  // targetModel: 'text-embedding-3-large', // Default: 3072 dimensions
  
  // Custom dimensions (optional - only for 003 models)
  targetDimensions: undefined, // Leave undefined for default dimensions
  // targetDimensions: 512,    // For text-embedding-3-small: 512, 1024, or 1536
  // targetDimensions: 1024,   // For text-embedding-3-large: 256, 1024, 1536, 2048, or 3072
  
  // Batch size for processing chunks
  batchSize: 10,
  
  // Rate limiting (requests per minute)
  requestsPerMinute: 3000, // Adjust based on your OpenAI tier
};

interface ChunkRow {
  id: number;
  content: string;
  document_id: number;
  metadata: any;
  confidence_score: number;
}

// Get default dimensions for embedding models
function getDefaultDimensions(model: string): number {
  switch (model) {
    case 'text-embedding-ada-002':
      return 1536;
    case 'text-embedding-3-small':
      return 1536;
    case 'text-embedding-3-large':
      return 3072;
    default:
      throw new Error(`Unknown embedding model: ${model}`);
  }
}

// Check if migration is needed
async function checkMigrationNeeded(): Promise<boolean> {
  const currentDimensions = MIGRATION_CONFIG.targetDimensions || getDefaultDimensions(MIGRATION_CONFIG.currentModel);
  const targetDimensions = MIGRATION_CONFIG.targetDimensions || getDefaultDimensions(MIGRATION_CONFIG.targetModel);
  
  console.log(`Current model: ${MIGRATION_CONFIG.currentModel} (${currentDimensions} dimensions)`);
  console.log(`Target model: ${MIGRATION_CONFIG.targetModel} (${targetDimensions} dimensions)`);
  
  // Check if models or dimensions are different
  const modelChanged = MIGRATION_CONFIG.currentModel !== MIGRATION_CONFIG.targetModel;
  const dimensionsChanged = currentDimensions !== targetDimensions;
  
  if (!modelChanged && !dimensionsChanged) {
    console.log('No migration needed - models and dimensions are the same');
    return false;
  }
  
  console.log('Migration needed:');
  if (modelChanged) console.log(`  - Model change: ${MIGRATION_CONFIG.currentModel} → ${MIGRATION_CONFIG.targetModel}`);
  if (dimensionsChanged) console.log(`  - Dimension change: ${currentDimensions} → ${targetDimensions}`);
  
  return true;
}

// Update database schema if dimensions changed
async function updateDatabaseSchema(): Promise<void> {
  const targetDimensions = MIGRATION_CONFIG.targetDimensions || getDefaultDimensions(MIGRATION_CONFIG.targetModel);
  
  console.log(`Updating content_embedding column to vector(${targetDimensions})`);
  
  try {
    await pool.query(`
      ALTER TABLE rag_system.chunks 
      ALTER COLUMN content_embedding TYPE vector(${targetDimensions})
    `);
    console.log('Database schema updated successfully');
  } catch (error) {
    console.error('Failed to update database schema:', error);
    throw error;
  }
}

// Generate embedding with the target model
async function generateEmbedding(text: string): Promise<number[]> {
  const params: OpenAI.Embeddings.EmbeddingCreateParams = {
    model: MIGRATION_CONFIG.targetModel,
    input: text,
  };
  
  // Add dimensions parameter only for 003 models with custom dimensions
  if (MIGRATION_CONFIG.targetDimensions && MIGRATION_CONFIG.targetModel.includes('3-')) {
    params.dimensions = MIGRATION_CONFIG.targetDimensions;
  }
  
  const response = await openai.embeddings.create(params);
  return response.data[0].embedding;
}

// Process a batch of chunks
async function processBatch(chunks: ChunkRow[]): Promise<void> {
  console.log(`Processing batch of ${chunks.length} chunks...`);
  
  for (const chunk of chunks) {
    try {
      const newEmbedding = await generateEmbedding(chunk.content);
      
      await pool.query(
        'UPDATE rag_system.chunks SET content_embedding = $1 WHERE id = $2',
        [newEmbedding, chunk.id]
      );
      
      console.log(`Updated chunk ${chunk.id}`);
      
      // Rate limiting
      const delayMs = (60 * 1000) / MIGRATION_CONFIG.requestsPerMinute;
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
    } catch (error) {
      console.error(`Failed to update chunk ${chunk.id}:`, error);
      throw error;
    }
  }
}

// Main migration function
async function migrateEmbeddings(): Promise<void> {
  console.log('Starting embedding migration...');
  
  // Check if migration is needed
  if (!(await checkMigrationNeeded())) {
    return;
  }
  
  try {
    // Update database schema if needed
    const currentDimensions = getDefaultDimensions(MIGRATION_CONFIG.currentModel);
    const targetDimensions = MIGRATION_CONFIG.targetDimensions || getDefaultDimensions(MIGRATION_CONFIG.targetModel);
    
    if (currentDimensions !== targetDimensions) {
      await updateDatabaseSchema();
    }
    
    // Get total count
    const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) as count FROM rag_system.chunks');
    console.log(`Total chunks to migrate: ${count}`);
    
    // Process chunks in batches
    let offset = 0;
    let processedCount = 0;
    
    while (offset < count) {
      const { rows: chunks } = await pool.query(
        'SELECT id, content, document_id, metadata, confidence_score FROM rag_system.chunks ORDER BY id LIMIT $1 OFFSET $2',
        [MIGRATION_CONFIG.batchSize, offset]
      );
      
      if (chunks.length === 0) break;
      
      await processBatch(chunks);
      
      processedCount += chunks.length;
      offset += MIGRATION_CONFIG.batchSize;
      
      console.log(`Progress: ${processedCount}/${count} chunks migrated (${Math.round(processedCount/count*100)}%)`);
    }
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Cost estimation function
async function estimateMigrationCost(): Promise<void> {
  const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) as count FROM rag_system.chunks');
  const { rows } = await pool.query('SELECT AVG(LENGTH(content)) as avg_length FROM rag_system.chunks');
  const avgLength = parseInt(rows[0].avg_length) || 500;
  
  // OpenAI pricing (as of 2024 - verify current pricing)
  const pricing = {
    'text-embedding-3-small': 0.00002, // per 1K tokens
    'text-embedding-3-large': 0.00013, // per 1K tokens
    'text-embedding-ada-002': 0.0001,  // per 1K tokens
  };
  
  const tokensPerChunk = Math.ceil(avgLength / 4); // Rough estimate: 4 chars per token
  const totalTokens = count * tokensPerChunk;
  const cost = (totalTokens / 1000) * (pricing[MIGRATION_CONFIG.targetModel as keyof typeof pricing] || 0);
  
  console.log('\n=== MIGRATION COST ESTIMATION ===');
  console.log(`Total chunks: ${count}`);
  console.log(`Average content length: ${avgLength} characters`);
  console.log(`Estimated tokens per chunk: ${tokensPerChunk}`);
  console.log(`Total estimated tokens: ${totalTokens.toLocaleString()}`);
  console.log(`Estimated cost: $${cost.toFixed(4)}`);
  console.log('=====================================\n');
}

// Main execution
async function main() {
  try {
    console.log('=== EMBEDDING MIGRATION TOOL ===\n');
    
    // Show cost estimation
    await estimateMigrationCost();
    
    // Run migration
    await migrateEmbeddings();
    
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { migrateEmbeddings, estimateMigrationCost, MIGRATION_CONFIG }; 