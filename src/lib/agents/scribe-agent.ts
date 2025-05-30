import { db } from '../db';
import { agentConfigurations, contentPipeline } from '../db/schema';
import { eq } from 'drizzle-orm';

const APP_API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_URL}`;

interface OutlineData {
  final_title: string;
  introduction_summary: string;
  sections: Array<{
    title: string;
    content?: string;
  }>;
  seo_keywords?: string[];
}

interface ArticleData {
  shopify_title?: string;
  html_content: string;
  meta_description?: string;
  shopify_tags?: string[];
  suggested_shopify_blog_id?: string;
}

export async function runScribeAgent(outlineTaskId: number) {
  console.log(`Scribe Agent started for outline task ID: ${outlineTaskId}`);
  try {
    // 1. Fetch the 'blog_outline' task
    const outlineTask = await db.query.contentPipeline.findFirst({
      where: eq(contentPipeline.id, outlineTaskId),
      with: {
        relatedTask: true
      }
    });

    if (!outlineTask || outlineTask.task_type !== 'blog_outline' || outlineTask.status !== 'pending') {
      console.log(`No pending blog outline found for task ID ${outlineTaskId}`);
      return { success: true, message: "No task found or not in correct state."};
    }

    const outlineData = outlineTask.data as OutlineData;
    const ideaData = outlineTask.relatedTask?.data;

    // Update status to 'in_progress'
    await db.update(contentPipeline)
      .set({ status: 'in_progress', updated_at: new Date() })
      .where(eq(contentPipeline.id, outlineTaskId))
      .execute();
    
    // 2. Fetch Agent Configuration
    const agentConfig = await db.query.agentConfigurations.findFirst({
      where: eq(agentConfigurations.agent_type, 'scribe')
    });
    if (!agentConfig) throw new Error("Scribe agent configuration not found.");

    // 3. RAG Query for each section
    const sectionQueries = outlineData.sections.map(async (section) => {
      const ragQuery = `Detailed information about "${section.title}" in the context of ${outlineData.final_title} for ${outlineTask.target_audience}`;
      const ragResponse = await fetch(`${APP_API_BASE_URL}/api/rag/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: ragQuery, topK: 5 }),
      });
      if (!ragResponse.ok) throw new Error(`RAG query failed for section "${section.title}": ${await ragResponse.text()}`);
      const ragData = await ragResponse.json();
      return {
        section: section.title,
        chunks: ragData.chunks || []
      };
    });
    const sectionRagResults = await Promise.all(sectionQueries);
    
    // 4. Construct LLM Prompt for full article
    let llmPrompt = agentConfig.base_prompt
        .replace('{{BLOG_TITLE}}', outlineData.final_title)
        .replace('{{TARGET_AUDIENCE}}', outlineTask.target_audience || '')
        .replace('{{OUTLINE_JSON}}', JSON.stringify(outlineData))
        .replace('{{SECTION_RAG_CONTEXT}}', JSON.stringify(sectionRagResults));

    // 5. Call Generic Text Generation API
    const llmParams = agentConfig.default_parameters || {};
    const generationResponse = await fetch(`${APP_API_BASE_URL}/api/generate/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: llmPrompt, model: agentConfig.llm_model_name, ...llmParams }),
    });
    if (!generationResponse.ok) throw new Error(`LLM article generation failed: ${await generationResponse.text()}`);
    const generationData = await generationResponse.json();
    
    let articleJson: ArticleData;
    try {
        articleJson = JSON.parse(generationData.generatedText);
    } catch (parseError) {
        console.error("Failed to parse LLM JSON article output:", generationData.generatedText);
        throw new Error("LLM output was not valid JSON.");
    }

    // Get all unique chunk and document IDs from section results
    const allChunkIds = sectionRagResults.flatMap(sr => sr.chunks.map((c: any) => c.id));
    const allDocumentIds = [...new Set(sectionRagResults.flatMap(sr => sr.chunks.map((c: any) => c.document_id)))];
    
    // 6. Create new 'blog_draft' task
    await db.insert(contentPipeline)
      .values({
        task_type: 'blog_draft',
        status: 'pending_review',
        related_pipeline_id: outlineTaskId,
        title: articleJson.shopify_title || outlineData.final_title,
        summary: articleJson.meta_description || outlineData.introduction_summary,
        target_audience: outlineTask.target_audience,
        keywords: articleJson.shopify_tags || outlineData.seo_keywords || [],
        data: {
          shopify_title: articleJson.shopify_title,
          html_content: articleJson.html_content,
          meta_description: articleJson.meta_description,
          shopify_tags: articleJson.shopify_tags,
          suggested_shopify_blog_id: articleJson.suggested_shopify_blog_id,
          source_outline: outlineData,
          source_idea: ideaData
        },
        source_chunk_ids: allChunkIds,
        source_document_ids: allDocumentIds
      })
      .execute();

    // 7. Mark outline task as completed
    await db.update(contentPipeline)
      .set({ 
        status: 'completed', 
        completed_at: new Date(), 
        updated_at: new Date() 
      })
      .where(eq(contentPipeline.id, outlineTaskId))
      .execute();
    
    console.log(`Scribe Agent finished for task ID: ${outlineTaskId}. Draft created.`);
    return { success: true, message: `Draft created for task ${outlineTaskId}.` };

  } catch (error: any) {
    console.error(`Scribe Agent Error for task ID ${outlineTaskId}:`, error);
    await db.update(contentPipeline)
      .set({ 
        status: 'error', 
        error_message: error.message, 
        updated_at: new Date() 
      })
      .where(eq(contentPipeline.id, outlineTaskId))
      .execute();
    return { success: false, message: error.message };
  }
} 