import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const APP_API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_URL}`;

export async function runScribeAgent(outlineTaskId: number) {
  console.log(`Scribe Agent started for outline task ID: ${outlineTaskId}`);
  try {
    // 1. Fetch the 'blog_outline' task
    const taskRes = await pool.query(
      `SELECT co.id, co.title, co.target_audience, co.data as outline_data,
              ci.data as idea_data
       FROM marketing.content_pipeline co
       LEFT JOIN marketing.content_pipeline ci ON co.related_pipeline_id = ci.id
       WHERE co.id = $1 AND co.task_type = 'blog_outline' AND co.status = 'pending'`,
      [outlineTaskId]
    );
    if (taskRes.rows.length === 0) {
      console.log(`No pending blog outline found for task ID ${outlineTaskId}`);
      return { success: true, message: "No task found or not in correct state."};
    }
    const outlineTask = taskRes.rows[0];
    const outlineData = outlineTask.outline_data;
    const ideaData = outlineTask.idea_data;

    // Update status to 'in_progress'
    await pool.query("UPDATE marketing.content_pipeline SET status = $1, updated_at = NOW() WHERE id = $2", ['in_progress', outlineTaskId]);
    
    // 2. Fetch Agent Configuration
    const agentConfigRes = await pool.query(
      "SELECT base_prompt, llm_model_name, default_parameters FROM marketing.agent_configurations WHERE agent_type = 'scribe'"
    );
    if (agentConfigRes.rows.length === 0) throw new Error("Scribe agent configuration not found.");
    const agentConfig = agentConfigRes.rows[0];

    // 3. RAG Query for each section
    const sectionQueries = outlineData.sections.map(async (section: any) => {
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
        .replace('{{TARGET_AUDIENCE}}', outlineTask.target_audience)
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
    
    let articleJson: any;
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
    await pool.query(
      `INSERT INTO marketing.content_pipeline 
       (task_type, status, related_pipeline_id, title, summary, target_audience, keywords, data, source_chunk_ids, source_document_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        'blog_draft',
        'pending_review',
        outlineTaskId,
        articleJson.shopify_title || outlineData.final_title,
        articleJson.meta_description || outlineData.introduction_summary,
        outlineTask.target_audience,
        JSON.stringify(articleJson.shopify_tags || outlineData.seo_keywords || []),
        JSON.stringify({
          shopify_title: articleJson.shopify_title,
          html_content: articleJson.html_content,
          meta_description: articleJson.meta_description,
          shopify_tags: articleJson.shopify_tags,
          suggested_shopify_blog_id: articleJson.suggested_shopify_blog_id,
          source_outline: outlineData,
          source_idea: ideaData
        }),
        allChunkIds,
        allDocumentIds
      ]
    );

    // 7. Mark outline task as completed
    await pool.query("UPDATE marketing.content_pipeline SET status = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2", ['completed', outlineTaskId]);
    
    console.log(`Scribe Agent finished for task ID: ${outlineTaskId}. Draft created.`);
    return { success: true, message: `Draft created for task ${outlineTaskId}.` };

  } catch (error: any) {
    console.error(`Scribe Agent Error for task ID ${outlineTaskId}:`, error);
    await pool.query("UPDATE marketing.content_pipeline SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3", ['error', error.message, outlineTaskId]);
    return { success: false, message: error.message };
  }
} 