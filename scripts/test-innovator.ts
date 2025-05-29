#!/usr/bin/env tsx

import { runInnovatorAgent } from '../src/lib/agents/innovator-agent';

async function testInnovatorAgent() {
  console.log('=== Testing Innovator Agent ===\n');

  // Test 1: General theme
  console.log('Test 1: General Theme - Sustainable Chemistry');
  try {
    const result1 = await runInnovatorAgent({
      focusType: 'general_theme',
      focusValue: 'Sustainable chemistry practices',
      targetAudience: 'R&D Chemists and Process Engineers',
      numIdeasPerApplication: 3
    });
    console.log('Result:', result1);
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Enriched product (assuming product ID 1 exists)
  console.log('Test 2: Enriched Product ID - Sample Product');
  try {
    const result2 = await runInnovatorAgent({
      focusType: 'enriched_product_id',
      focusValue: '1', // Assuming product with ID 1 exists
      targetAudience: 'Laboratory Managers and Safety Officers',
      numIdeasPerApplication: 2
    });
    console.log('Result:', result2);
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n=== Test Complete ===');
}

// Run the test
testInnovatorAgent().catch(console.error); 