import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkRagStatus() {
  try {
    console.log('=== RAG SYSTEM STATUS CHECK ===\n');

    // Check if RAG tables exist
    const { rows: tables } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'rag_system' 
      AND table_type = 'BASE TABLE'
    `);

    if (tables.length === 0) {
      console.log('❌ No RAG tables found. You may need to set up your RAG system first.');
      return;
    }

    console.log('✅ RAG tables found:', tables.map(t => t.table_name).join(', '));

    // Check chunks table structure
    const { rows: columns } = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'rag_system' 
      AND table_name = 'chunks'
      ORDER BY ordinal_position
    `);

    if (columns.length > 0) {
      console.log('\n📋 Chunks table structure:');
      columns.forEach(col => {
        if (col.column_name === 'content_embedding') {
          // Try to get vector dimension
          pool.query(`
            SELECT data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_schema = 'rag_system' 
            AND table_name = 'chunks' 
            AND column_name = 'content_embedding'
          `).then(result => {
            console.log(`  🔍 ${col.column_name}: ${result.rows[0]?.udt_name || col.data_type}`);
          });
        } else {
          console.log(`  - ${col.column_name}: ${col.data_type}`);
        }
      });
    }

    // Check data counts
    const { rows: [{ chunkCount }] } = await pool.query('SELECT COUNT(*) as "chunkCount" FROM rag_system.chunks');
    const { rows: [{ docCount }] } = await pool.query('SELECT COUNT(*) as "docCount" FROM rag_system.documents');

    console.log('\n📊 Data Summary:');
    console.log(`  - Documents: ${docCount}`);
    console.log(`  - Chunks: ${chunkCount}`);

    if (chunkCount > 0) {
      // Check content length statistics
      const { rows: [stats] } = await pool.query(`
        SELECT 
          AVG(LENGTH(content))::int as avg_length,
          MIN(LENGTH(content)) as min_length,
          MAX(LENGTH(content)) as max_length
        FROM rag_system.chunks
      `);

      console.log('\n📏 Content Statistics:');
      console.log(`  - Average content length: ${stats.avg_length} characters`);
      console.log(`  - Min content length: ${stats.min_length} characters`);
      console.log(`  - Max content length: ${stats.max_length} characters`);

      // Estimate embedding dimensions by checking a sample
      const { rows: sampleChunks } = await pool.query(`
        SELECT content_embedding 
        FROM rag_system.chunks 
        WHERE content_embedding IS NOT NULL 
        LIMIT 1
      `);

      if (sampleChunks.length > 0 && sampleChunks[0].content_embedding) {
        const embedding = sampleChunks[0].content_embedding;
        // Parse the vector string to count dimensions
        const vectorMatch = embedding.match(/\[([^\]]+)\]/);
        if (vectorMatch) {
          const dimensions = vectorMatch[1].split(',').length;
          console.log(`\n🔢 Current embedding dimensions: ${dimensions}`);
          
          // Suggest which model might be in use
          if (dimensions === 1536) {
            console.log('  💡 Likely using: text-embedding-ada-002 or text-embedding-3-small (default)');
          } else if (dimensions === 3072) {
            console.log('  💡 Likely using: text-embedding-3-large (default)');
          } else if (dimensions === 512) {
            console.log('  💡 Likely using: text-embedding-3-small (512D) or text-embedding-3-large (custom)');
          } else {
            console.log(`  💡 Custom dimension configuration: ${dimensions}D`);
          }
        }
      } else {
        console.log('\n⚠️  No embeddings found in chunks - you may need to run document ingestion first');
      }

      // Cost estimation for different models
      const tokensPerChunk = Math.ceil(stats.avg_length / 4);
      const totalTokens = chunkCount * tokensPerChunk;

      console.log('\n💰 Migration Cost Estimates:');
      console.log(`  - Total estimated tokens: ${totalTokens.toLocaleString()}`);
      
      const costs = {
        'text-embedding-3-small': (totalTokens / 1000) * 0.00002,
        'text-embedding-3-large': (totalTokens / 1000) * 0.00013,
        'text-embedding-ada-002': (totalTokens / 1000) * 0.0001,
      };

      Object.entries(costs).forEach(([model, cost]) => {
        console.log(`  - ${model}: $${cost.toFixed(4)}`);
      });
    }

    // Check for recent activity
    const { rows: recentDocs } = await pool.query(`
      SELECT created_at 
      FROM rag_system.documents 
      ORDER BY created_at DESC 
      LIMIT 1
    `);

    if (recentDocs.length > 0) {
      const lastActivity = new Date(recentDocs[0].created_at);
      const daysSince = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`\n⏰ Last document added: ${daysSince} days ago (${lastActivity.toLocaleDateString()})`);
    }

    console.log('\n🎯 Recommendations:');
    
    if (chunkCount === 0) {
      console.log('  1. Add some documents to your RAG system first');
      console.log('  2. Test the current setup before planning migration');
    } else {
      console.log('  1. Review the migration guide: docs/rag-embedding-upgrade-guide.md');
      console.log('  2. Choose your target model based on cost/performance needs');
      console.log('  3. Run migration cost estimation: npx tsx scripts/migrate-embeddings.ts');
      console.log('  4. Plan a maintenance window for the migration');
    }

    console.log('\n================================\n');

  } catch (error: any) {
    console.error('Error checking RAG status:', error);
    
    if (error.code === '42P01') {
      console.log('\n❌ RAG tables not found. You may need to:');
      console.log('  1. Run database migrations');
      console.log('  2. Set up your RAG system schema');
      console.log('  3. Check your DATABASE_URL environment variable');
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  checkRagStatus();
}

export { checkRagStatus }; 