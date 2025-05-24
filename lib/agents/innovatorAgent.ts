import { db } from '../../src/lib/db';
import { agentConfigurations } from '../../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

const APP_API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_URL}`;

interface InnovatorInput {
  focusType: 'chemical' | 'product_category' | 'general_theme';
  focusValue: string;
  targetAudience: string;
}

export async function runInnovatorAgent(input: InnovatorInput) {
  console.log(`Innovator Agent started for: ${input.focusValue}`);
  try {
    // 1. Fetch Agent Configuration
    const agentConfig = await db.query.agentConfigurations.findFirst({
      where: eq(agentConfigurations.agent_type, 'innovator')
    });
    if (!agentConfig) throw new Error("Innovator agent configuration not found.");

    // 2. RAG Query
    const ragQuery = `Potential applications and key considerations for ${input.focusValue} relevant to ${input.targetAudience}`;
    const ragResponse = await fetch(`${APP_API_BASE_URL}/api/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: ragQuery, topK: 10 }),
    });
    if (!ragResponse.ok) throw new Error(`RAG query failed: ${await ragResponse.text()}`);
    const ragData = await ragResponse.json();
    const ragContextChunks: any[] = ragData.chunks || [];
    const ragContextString = ragContextChunks.map(c => `Document: ${c.document_name}\nContent: ${c.content}`).join("\n\n---\n\n");

    // 3. Shopify Sync Data
    let shopifyProductInfoString = "No specific product data queried.";
    if (input.focusType === 'product_category' || input.focusType === 'chemical') {
      const products = await db.query.products.findMany({
        where: sql`title ILIKE ${`%${input.focusValue}%`} OR tags ILIKE ${`%${input.focusValue}%`} OR product_type ILIKE ${`%${input.focusValue}%`}`,
        limit: 5
      });
      if (products.length > 0) {
        shopifyProductInfoString = products.map(p => `Product: ${p.title}\nDescription: ${p.description?.substring(0, 200)}...\nTags: ${p.tags}`).join("\n---\n");
      }
    }
    
    // 4. Construct LLM Prompt
    let llmPrompt = agentConfig.base_prompt
        .replace('{{FOCUS_VALUE}}', input.focusValue)
        .replace('{{TARGET_AUDIENCE}}', input.targetAudience)
        .replace('{{RAG_CONTEXT}}', ragContextString)
        .replace('{{SHOPIFY_PRODUCT_INFO}}', shopifyProductInfoString);
    
    // 5. Call Generic Text Generation API
    const llmParams = agentConfig.default_parameters || {};
    const generationResponse = await fetch(`${APP_API_BASE_URL}/api/generate/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: llmPrompt,
        model: agentConfig.llm_model_name,
        ...llmParams
      }),
    });
    if (!generationResponse.ok) throw new Error(`LLM generation failed: ${await generationResponse.text()}`);
    const generationData = await generationResponse.json();
    
    // 6. Parse LLM Output
    let ideas: any[];
    try {
        ideas = JSON.parse(generationData.generatedText);
    } catch (parseError) {
        console.error("Failed to parse LLM JSON output:", generationData.generatedText);
        throw new Error("LLM output was not valid JSON.");
    }

    // 7. Store in marketing.content_pipeline
    for (const idea of ideas) {
      for (const angle of idea.potential_blog_angles) {
        await db.insert(db.contentPipeline)
          .values({
            task_type: 'blog_idea',
            status: 'pending',
            title: angle,
            summary: idea.application,
            target_audience: idea.target_audience_suggestion || input.targetAudience,
            data: JSON.stringify({
                original_application: idea.application,
                suggested_title: angle,
                key_points_suggestion: [],
                source_focus: input.focusValue
            }),
            source_chunk_ids: ragContextChunks.map(c => c.id),
            source_document_ids: [...new Set(ragContextChunks.map(c => c.document_id))]
          })
          .returning({ id: db.contentPipeline.id })
          .execute();
        console.log(`Stored blog idea: ${angle}`);
      }
    }
    console.log(`Innovator Agent finished for: ${input.focusValue}`);
    return { success: true, message: `${ideas.length} ideas processed.` };

  } catch (error: any) {
    console.error(`Innovator Agent Error for ${input.focusValue}:`, error);
    return { success: false, message: error.message };
  }
} 