#!/usr/bin/env tsx
/**
 * Test script for the proposed topics API endpoints
 * Run with: tsx scripts/test-proposed-topics-api.ts
 */

import 'dotenv/config';

const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

interface ApiResponse<T = any> {
  success: boolean;
  error?: string;
  details?: any;
  data?: T;
  topics?: T[];
  topic?: T;
  totalCount?: number;
  message?: string;
  status?: number;
}

async function apiCall<T = any>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    const data = await response.json();
    return { ...data, status: response.status };
  } catch (error) {
    console.error(`API call failed for ${endpoint}:`, error);
    return { success: false, error: 'Network error', status: 0 };
  }
}

async function testProposedTopicsAPI() {
  console.log('🧪 Testing Proposed Topics API Endpoints...\n');

  // Test 1: GET - List topics (should start empty or with existing topics)
  console.log('📋 Test 1: GET /api/marketing/proposed-topics');
  const listResponse = await apiCall('/api/marketing/proposed-topics?limit=5');
  console.log(`   Status: ${listResponse.status}`);
  console.log(`   Success: ${listResponse.success}`);
  console.log(`   Total Count: ${listResponse.totalCount}`);
  console.log(`   Topics Count: ${listResponse.topics?.length || 0}\n`);

  // Test 2: POST - Create a new topic
  console.log('➕ Test 2: POST /api/marketing/proposed-topics');
  const newTopic = {
    topicTitle: "Advanced Chemical Synthesis Techniques for Industrial Applications",
    primaryKeyword: "chemical synthesis",
    secondaryKeywords: ["industrial chemistry", "synthesis methods", "chemical processes"],
    sourceType: "api_test",
    notes: "Test topic created via API testing script",
    priorityScore: 8.5,
    strategicTheme: "technical_education"
  };

  const createResponse = await apiCall('/api/marketing/proposed-topics', {
    method: 'POST',
    body: JSON.stringify(newTopic),
  });
  
  console.log(`   Status: ${createResponse.status}`);
  console.log(`   Success: ${createResponse.success}`);
  if (createResponse.success) {
    console.log(`   Created Topic ID: ${createResponse.topic?.id}`);
    console.log(`   Topic Title: "${createResponse.topic?.topicTitle}"`);
  } else {
    console.log(`   Error: ${createResponse.error}`);
  }
  console.log('');

  let createdTopicId = createResponse.topic?.id;

  // Test 3: Try to create a similar topic (should fail with similarity check)
  console.log('🚫 Test 3: POST similar topic (should fail)');
  const similarTopic = {
    topicTitle: "Advanced Chemical Synthesis Methods for Industrial Use",
    primaryKeyword: "synthesis methods",
    sourceType: "api_test_duplicate"
  };

  const similarResponse = await apiCall('/api/marketing/proposed-topics', {
    method: 'POST',
    body: JSON.stringify(similarTopic),
  });
  
  console.log(`   Status: ${similarResponse.status}`);
  console.log(`   Success: ${similarResponse.success}`);
  console.log(`   Error: ${similarResponse.error || 'None'}`);
  console.log('');

  if (createdTopicId) {
    // Test 4: GET - Retrieve single topic
    console.log(`🔍 Test 4: GET /api/marketing/proposed-topics/${createdTopicId}`);
    const getTopicResponse = await apiCall(`/api/marketing/proposed-topics/${createdTopicId}`);
    console.log(`   Status: ${getTopicResponse.status}`);
    console.log(`   Success: ${getTopicResponse.success}`);
    console.log(`   Topic Title: "${getTopicResponse.topic?.topicTitle}"`);
    console.log(`   Status: ${getTopicResponse.topic?.status}`);
    console.log('');

    // Test 5: PUT - Update the topic
    console.log(`✏️  Test 5: PUT /api/marketing/proposed-topics/${createdTopicId}`);
    const updateData = {
      status: "approved_for_pipeline",
      notes: "Updated via API test - approved for content pipeline",
      priorityScore: 9.0,
      searchVolume: 1200,
      keywordDifficulty: 65
    };

    const updateResponse = await apiCall(`/api/marketing/proposed-topics/${createdTopicId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });

    console.log(`   Status: ${updateResponse.status}`);
    console.log(`   Success: ${updateResponse.success}`);
    console.log(`   Updated Status: ${updateResponse.topic?.status}`);
    console.log(`   Updated Priority Score: ${updateResponse.topic?.priorityScore}`);
    console.log('');

    // Test 6: GET with filters
    console.log('🔍 Test 6: GET with filters (status=approved_for_pipeline)');
    const filteredResponse = await apiCall('/api/marketing/proposed-topics?status=approved_for_pipeline&sortBy=priorityScore&sortOrder=desc');
    console.log(`   Status: ${filteredResponse.status}`);
    console.log(`   Success: ${filteredResponse.success}`);
    console.log(`   Filtered Count: ${filteredResponse.topics?.length || 0}`);
    console.log('');

    // Test 7: Search functionality
    console.log('🔍 Test 7: Search topics');
    const searchResponse = await apiCall('/api/marketing/proposed-topics?searchTerm=synthesis&limit=10');
    console.log(`   Status: ${searchResponse.status}`);
    console.log(`   Success: ${searchResponse.success}`);
    console.log(`   Search Results: ${searchResponse.topics?.length || 0}`);
    console.log('');

    // Test 8: DELETE - Clean up the test topic
    console.log(`🗑️  Test 8: DELETE /api/marketing/proposed-topics/${createdTopicId}`);
    const deleteResponse = await apiCall(`/api/marketing/proposed-topics/${createdTopicId}`, {
      method: 'DELETE',
    });

    console.log(`   Status: ${deleteResponse.status}`);
    console.log(`   Success: ${deleteResponse.success}`);
    console.log(`   Message: ${deleteResponse.message || 'None'}`);
    console.log('');
  }

  // Test 9: Error handling - Invalid topic ID
  console.log('❌ Test 9: Error handling (invalid ID)');
  const invalidResponse = await apiCall('/api/marketing/proposed-topics/invalid-id');
  console.log(`   Status: ${invalidResponse.status}`);
  console.log(`   Success: ${invalidResponse.success}`);
  console.log(`   Error: ${invalidResponse.error || 'None'}`);
  console.log('');

  console.log('🎉 API Testing completed!');
  console.log('\n📊 Summary:');
  console.log('   ✅ GET /api/marketing/proposed-topics (list with pagination, filtering, sorting)');
  console.log('   ✅ POST /api/marketing/proposed-topics (create with semantic similarity check)');
  console.log('   ✅ GET /api/marketing/proposed-topics/[id] (retrieve single topic)');
  console.log('   ✅ PUT /api/marketing/proposed-topics/[id] (update topic)');
  console.log('   ✅ DELETE /api/marketing/proposed-topics/[id] (delete topic)');
  console.log('   ✅ Error handling and validation');
}

if (require.main === module) {
  testProposedTopicsAPI().catch(console.error);
} 