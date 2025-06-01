#!/usr/bin/env tsx
/**
 * Test script for the new Google Gemini embedding client
 * Run with: tsx scripts/test-embeddings.ts
 */

import 'dotenv/config';
import { generateGeminiEmbedding, EMBEDDING_DIMENSIONS } from '../src/lib/ai/embedding-client';
import { TaskType } from '@google/generative-ai';

async function testEmbeddings() {
  console.log('🧪 Testing Google Gemini text-embedding-004...\n');

  const testTexts = [
    "Advanced polymer synthesis techniques",
    "Chemical safety protocols for laboratory environments",
    "Organic chemistry fundamentals",
    "Polymer synthesis methods", // Similar to first one
  ];

  console.log(`Expected embedding dimensions: ${EMBEDDING_DIMENSIONS}\n`);

  for (let i = 0; i < testTexts.length; i++) {
    const text = testTexts[i];
    console.log(`📝 Test ${i + 1}: "${text}"`);
    
    try {
      // Test with RETRIEVAL_DOCUMENT (default)
      const embeddingDoc = await generateGeminiEmbedding(text, TaskType.RETRIEVAL_DOCUMENT);
      console.log(`   ✅ RETRIEVAL_DOCUMENT: ${embeddingDoc.length} dimensions`);
      console.log(`   📊 Sample values: [${embeddingDoc.slice(0, 5).map(v => v.toFixed(4)).join(', ')}, ...]`);
      
      // Test with SEMANTIC_SIMILARITY
      const embeddingSem = await generateGeminiEmbedding(text, TaskType.SEMANTIC_SIMILARITY);
      console.log(`   ✅ SEMANTIC_SIMILARITY: ${embeddingSem.length} dimensions`);
      
      // Verify dimensions
      if (embeddingDoc.length !== EMBEDDING_DIMENSIONS) {
        console.error(`   ❌ Dimension mismatch! Expected ${EMBEDDING_DIMENSIONS}, got ${embeddingDoc.length}`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error generating embedding: ${error}`);
    }
    console.log('');
  }

  // Test semantic similarity between similar texts
  console.log('🔍 Testing semantic similarity...\n');
  
  try {
    const embedding1 = await generateGeminiEmbedding(testTexts[0], TaskType.SEMANTIC_SIMILARITY);
    const embedding2 = await generateGeminiEmbedding(testTexts[3], TaskType.SEMANTIC_SIMILARITY); // Similar text
    
    // Calculate cosine similarity manually
    const dotProduct = embedding1.reduce((sum, val, i) => sum + val * embedding2[i], 0);
    const magnitude1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));
    const cosineSimilarity = dotProduct / (magnitude1 * magnitude2);
    
    console.log(`Text 1: "${testTexts[0]}"`);
    console.log(`Text 2: "${testTexts[3]}"`);
    console.log(`Cosine similarity: ${cosineSimilarity.toFixed(4)}`);
    
    if (cosineSimilarity > 0.7) {
      console.log('✅ High semantic similarity detected (as expected)');
    } else {
      console.log('⚠️  Lower similarity than expected');
    }
    
  } catch (error) {
    console.error(`❌ Error testing semantic similarity: ${error}`);
  }

  console.log('\n🎉 Embedding tests completed!');
}

if (require.main === module) {
  testEmbeddings().catch(console.error);
} 