import { db } from '../../src/lib/db';
import { agentConfigurations, contentPipeline } from '../../src/lib/db/schema';
import { eq } from 'drizzle-orm';
const APP_API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_URL}`;

export async function runArchitectAgent(pipelineTaskId: number) {
  console.log(`Architect Agent started for pipeline task ID: ${pipelineTaskId}`);
  try {
    // 1. Fetch the 'blog_idea' task
    const blogIdeaTask = await db.query.contentPipeline.findFirst({
      where: eq(contentPipeline.id, pipelineTaskId)
    });
    if (!blogIdeaTask || blogIdeaTask.task_type !== 'blog_idea' || blogIdeaTask.status !== 'pending') {
      console.log(`No pending blog idea found for task ID ${pipelineTaskId}`);
      return { success: true, message: "No task found or not in correct state."};
    }
    const ideaData = blogIdeaTask.data || {};

    // Update status to 'in_progress'
    await db.update(contentPipeline)
      .set({ status: 'in_progress', updatedAt: new Date() })
      .where(eq(contentPipeline.id, pipelineTaskId))
      .execute();
    
    // 2. Fetch Agent Configuration
    const agentConfig = await db.query.agentConfigurations.findFirst({
      where: eq(agentConfigurations.agent_type, 'architect')
    });
    if (!agentConfig) throw new Error("Architect agent configuration not found.");

    // 3. RAG Query
    const ragQuery = `Detailed information supporting a blog post titled "${ideaData.suggested_title || ''}" about ${ideaData.source_focus || ''} for ${blogIdeaTask.target_audience || ''}`;
    const ragResponse = await fetch(`${APP_API_BASE_URL}/api/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: ragQuery, topK: 10 }),
    });
    if (!ragResponse.ok) throw new Error(`RAG query failed: ${await ragResponse.text()}`);
    const ragData = await ragResponse.json();
    const ragContextChunks: any[] = ragData.chunks || [];
    const ragContextString = ragContextChunks.map(c => `Document: ${c.document_name}\nContent: ${c.content}`).join("\n\n---\n\n");

    // 4. Construct LLM Prompt for outline
    let llmPrompt = agentConfig.base_prompt
        .replace('{{BLOG_IDEA_TITLE}}', ideaData.suggested_title || '')
        .replace('{{TARGET_AUDIENCE}}', blogIdeaTask.target_audience || '')
        .replace('{{KEY_POINTS_FROM_IDEA}}', (ideaData.key_points_suggestion || []).join(', '))
        .replace('{{RAG_CONTEXT}}', ragContextString);

    // 5. Call Generic Text Generation API
    const llmParams = agentConfig.default_parameters || {};
    const generationResponse = await fetch(`${APP_API_BASE_URL}/api/generate/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: llmPrompt, model: agentConfig.llm_model_name, ...llmParams }),
    });
    if (!generationResponse.ok) throw new Error(`LLM outline generation failed: ${await generationResponse.text()}`);
    const generationData = await generationResponse.json();
    
    let outlineJson: any;
    try {
        outlineJson = JSON.parse(generationData.generatedText);
    } catch (parseError) {
        console.error("Failed to parse LLM JSON outline output:", generationData.generatedText);
        throw new Error("LLM outline output was not valid JSON.");
    }
    
    // 6. Create new 'blog_outline' task
    await db.insert(contentPipeline)
      .values({
        task_type: 'blog_outline',
        status: 'pending',
        related_pipeline_id: pipelineTaskId,
        title: outlineJson.final_title || ideaData.suggested_title || '',
        summary: outlineJson.introduction_summary || '',
        target_audience: blogIdeaTask.target_audience || '',
        keywords: outlineJson.seo_keywords || [],
        data: outlineJson,
        source_chunk_ids: ragContextChunks.map(c => c.id),
        source_document_ids: [...new Set(ragContextChunks.map(c => c.document_id))]
      })
      .execute();

    // 7. Mark original 'blog_idea' task as completed
    await db.update(contentPipeline)
      .set({ 
        status: 'completed', 
        completed_at: new Date(), 
        updatedAt: new Date() 
      })
      .where(eq(contentPipeline.id, pipelineTaskId))
      .execute();
    
    console.log(`Architect Agent finished for task ID: ${pipelineTaskId}. Outline created.`);
    return { success: true, message: "Blog outline created successfully." };
  } catch (error: any) {
    console.error(`Architect Agent Error for task ID ${pipelineTaskId}:`, error);
    await db.update(contentPipeline)
      .set({ 
        status: 'error', 
        error_message: error.message, 
        updatedAt: new Date() 
      })
      .where(eq(contentPipeline.id, pipelineTaskId))
      .execute();
    return { success: false, message: error.message };
  }
} 