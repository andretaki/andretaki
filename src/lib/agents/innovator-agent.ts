import { db } from '../db';
import {
  agentConfigurations,
  shopifySyncProducts, // This is rag_system.shopifySyncProducts
  proposedTopics,
  // We need customVector for type hints if used directly in queries, but it's defined in schema.ts
} from '../db/schema';
import { eq, sql, ilike, or, and, desc } from 'drizzle-orm';
import { ShopifyMetafield } from '@/lib/shopify/client'; // For parsing metafields type
import { generateGeminiEmbedding, findSimilarTopicsWithPgVector } from '../ai/embedding-client'; // NEW - using the new client
import { TaskType } from '@google/generative-ai'; // Import TaskType for SEMANTIC_SIMILARITY

const APP_API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_URL}`;

// Namespace for your chemical metafields on Shopify
const CHEMICAL_METAFIELD_NAMESPACE = process.env.SHOPIFY_CHEMICAL_METAFIELD_NAMESPACE || 'chemflow_custom';

interface InnovatorInput {
  focusType: 'chemical' | 'product_category' | 'general_theme' | 'enriched_product_id';
  focusValue: string; // if enriched_product_id, this is rag_system.shopifySyncProducts.id (our DB's serial PK)
  targetAudience: string;
  numIdeasPerApplication?: number;
}

interface BlogIdeaLLMOutput {
  application: string; // This is a theme/category name from LLM
  potential_blog_angles: string[]; // Array of topic titles
  target_audience_suggestion?: string;
}

const DEFAULT_INNOVATOR_CONFIG = {
  llm_model_name: 'gemini-1.5-flash-latest', // Ensure this model is available and API key is set
  base_prompt: `You are an expert chemical marketing content ideation AI. Your goal is to generate blog topic ideas.
FOCUS: {{FOCUS_VALUE}}
TARGET AUDIENCE: {{TARGET_AUDIENCE}}

ADDITIONAL CONTEXT (Use if relevant, otherwise generate based on FOCUS and AUDIENCE):
Product Data (if any specific product mentioned in FOCUS):
{{SHOPIFY_PRODUCT_INFO}}
Research Context (from internal knowledge base):
{{RAG_CONTEXT}}

Based on all the information, generate 3-5 main application areas or sub-categories related to the FOCUS. For each area, provide 2-3 distinct and actionable blog topic ideas ("potential_blog_angles").
If the FOCUS is general (e.g., "General Chemical Topics"), the "application" field should represent broader chemical categories or themes.
Blog angles should be specific, engaging, and suggest clear value to the {{TARGET_AUDIENCE}}. Avoid generic titles.

Output Format Rules:
1.  You MUST return ONLY a valid JSON array.
2.  DO NOT include any text before or after the JSON array.
3.  DO NOT use markdown code block indicators like \`\`\`json or \`\`\`.
4.  The JSON array must follow this exact structure:
[
  {
    "application": "Specific Application or Category Name for {{FOCUS_VALUE}}",
    "potential_blog_angles": [
      "Angle 1: How {{FOCUS_VALUE}} Solves X for {{TARGET_AUDIENCE}}",
      "Angle 2: Advanced Techniques with {{FOCUS_VALUE}} in Y",
      "Angle 3: Future Trends of {{FOCUS_VALUE}} Impacting Z"
    ],
    "target_audience_suggestion": "Optional: Refined audience for this specific application angle"
  }
  // ... more objects like this
]
Ensure each "application" string is descriptive. Ensure each "potential_blog_angles" array contains specific and compelling topic titles.`,
  default_parameters: {
    temperature: 0.4,
    max_tokens: 4096
  }
};

const JSON_ARRAY_REGEX = /\[\s*(\{[\s\S]*?\})\s*(,\s*\{[\s\S]*?\})*\s*\]/;
const SIMILARITY_THRESHOLD = 0.80; // Adjusted threshold for text-embedding-004

// Helper to find a specific metafield value from the product's metafields JSONB
const findMetafieldValueFromProduct = (
  productMetafields: unknown, // Comes from shopifySyncProducts.metafields which is jsonb
  namespace: string,
  key: string
): string | undefined => {
  if (!productMetafields || !Array.isArray(productMetafields)) {
    return undefined;
  }
  const metafields = productMetafields as ShopifyMetafield[]; // Cast to known type
  const mf = metafields.find(m => m.namespace === namespace && m.key === key);
  return mf ? String(mf.value) : undefined; // Ensure value is string or handle type appropriately
};


export async function runInnovatorAgent(input: InnovatorInput) {
  const agentContext = `InnovatorAgent for focusValue="${input.focusValue}", type="${input.focusType}"`;
  console.log(`[${agentContext}] Started.`);
  let rawLlmResponseText = "LLM call did not complete or returned no text.";
  let associatedProductDbId: number | null = null;

  try {
    const agentConfigFromDb = await db.query.agentConfigurations.findFirst({
      where: eq(agentConfigurations.agent_type, 'innovator')
    });
    const agentConfig = agentConfigFromDb || DEFAULT_INNOVATOR_CONFIG;
    if (!agentConfigFromDb) console.log(`[${agentContext}] No DB config for 'innovator', using default.`);

    // --- RAG Context (Conceptual - assuming /api/rag/query works) ---
    const ragQuery = `Potential applications, key considerations, and interesting facts about ${input.focusValue} relevant to ${input.targetAudience}`;
    let ragContextString = "No specific RAG context available for this focus.";
    try {
        console.log(`[${agentContext}] RAG Query: "${ragQuery.substring(0,100)}..."`);
        const ragResponse = await fetch(`${APP_API_BASE_URL}/api/rag/query`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: ragQuery, topK: 3 }),
        });
        if (ragResponse.ok) {
          const ragData = await ragResponse.json();
          const ragContextChunks: any[] = ragData.chunks || [];
          if (ragContextChunks.length > 0) {
            ragContextString = ragContextChunks.map(c => `Source: ${c.document_name || 'Internal Note'}\nContent Snippet: ${c.content.substring(0, 150)}...`).join("\n---\n");
            console.log(`[${agentContext}] RAG context fetched (${ragContextChunks.length} chunks).`);
          } else console.log(`[${agentContext}] RAG query successful but returned no chunks.`);
        } else console.warn(`[${agentContext}] RAG query failed (Status: ${ragResponse.status}, Body: ${(await ragResponse.text()).substring(0,100)}...).`);
    } catch (e) { console.warn(`[${agentContext}] RAG query fetch error: ${e}`); }

    // --- Shopify Product Context (from rag_system.shopifySyncProducts) ---
    let shopifyProductInfoString = "No specific product data directly matching focus value found.";
    if (input.focusType === 'chemical' || input.focusType === 'product_category' || input.focusType === 'enriched_product_id') {
      const productDbIdNum = parseInt(input.focusValue);
      
      const productForContext = (input.focusType === 'enriched_product_id' && !isNaN(productDbIdNum))
        ? await db.query.shopifySyncProducts.findFirst({ where: eq(shopifySyncProducts.id, productDbIdNum) })
        : await db.query.shopifySyncProducts.findFirst({
            // Search by title, tags, or productType if not an explicit ID
            where: or(
                ilike(shopifySyncProducts.title, `%${input.focusValue}%`),
                ilike(shopifySyncProducts.tags, `%${input.focusValue}%`),
                ilike(shopifySyncProducts.productType, `%${input.focusValue}%`)
            ),
            orderBy: [desc(shopifySyncProducts.updatedAtShopify)]
          });

      if (productForContext) {
        associatedProductDbId = productForContext.id; // This is the rag_system.shopifySyncProducts.id
        const cas = findMetafieldValueFromProduct(productForContext.metafields, CHEMICAL_METAFIELD_NAMESPACE, 'cas_number') || 'N/A';
        const formula = findMetafieldValueFromProduct(productForContext.metafields, CHEMICAL_METAFIELD_NAMESPACE, 'chemical_formula') || 'N/A';
        shopifyProductInfoString = `Product: ${productForContext.title}\nDescription: ${productForContext.description?.substring(0, 100)}...\nTags: ${productForContext.tags}\nCAS: ${cas}\nFormula: ${formula}`;
        console.log(`[${agentContext}] Context from product DB ID ${associatedProductDbId}: ${productForContext.title}.`);
      } else {
        console.log(`[${agentContext}] No Shopify product found matching "${input.focusValue}".`);
      }
    }
    
    // --- LLM Call ---
    let llmPrompt = agentConfig.base_prompt
        .replace(new RegExp('{{FOCUS_VALUE}}', 'g'), input.focusValue)
        .replace(new RegExp('{{TARGET_AUDIENCE}}', 'g'), input.targetAudience)
        .replace('{{RAG_CONTEXT}}', ragContextString)
        .replace('{{SHOPIFY_PRODUCT_INFO}}', shopifyProductInfoString);
    
    const llmParams = agentConfig.default_parameters || {};
    console.log(`[${agentContext}] Calling LLM. Model: ${agentConfig.llm_model_name}. Prompt length: ${llmPrompt.length}.`);

    const generationApiResponse = await fetch(`${APP_API_BASE_URL}/api/generate/text`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: llmPrompt, model: agentConfig.llm_model_name, ...llmParams }),
    });
    const generationApiResult = await generationApiResponse.json();

    if (!generationApiResponse.ok || !generationApiResult.success) {
      rawLlmResponseText = generationApiResult.generatedText || generationApiResult.details || "LLM API call reported failure.";
      console.error(`[${agentContext}] LLM /api/generate/text call FAILED. Status: ${generationApiResponse.status}. API Result:`, generationApiResult);
      throw new Error(`LLM generation failed: ${generationApiResult.error || rawLlmResponseText.substring(0,200)}`);
    }
    rawLlmResponseText = generationApiResult.generatedText;
    
    let llmIdeas: BlogIdeaLLMOutput[];
    try {
      if (!rawLlmResponseText || rawLlmResponseText.trim() === "") throw new Error("LLM returned empty string.");
      let textToParse = rawLlmResponseText.trim();
      const match = textToParse.match(JSON_ARRAY_REGEX);
      textToParse = match && match[0] ? match[0] : textToParse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      
      if (!textToParse.startsWith('[') || !textToParse.endsWith(']')) {
        if (textToParse.startsWith('{') && textToParse.endsWith('}')) llmIdeas = [JSON.parse(textToParse)];
        else throw new Error("LLM response not valid JSON array/object after cleaning.");
      } else llmIdeas = JSON.parse(textToParse);
        
      if (!Array.isArray(llmIdeas) || llmIdeas.length === 0 || !llmIdeas.every(idea => idea.application && idea.potential_blog_angles && Array.isArray(idea.potential_blog_angles))) {
        throw new Error("Invalid idea structure or empty array from LLM.");
      }
      console.log(`[${agentContext}] Successfully parsed ${llmIdeas.length} blog idea sets from LLM.`);
    } catch (parseError: any) {
      console.error(`[${agentContext}] Failed to parse LLM JSON. Raw: "${rawLlmResponseText.substring(0,500)}". Error:`, parseError);
      llmIdeas = [{ // Fallback
        application: `${input.focusValue} - General Topics (Fallback)`,
        potential_blog_angles: [`Comprehensive Guide to ${input.focusValue}`, `Key Applications of ${input.focusValue}`],
        target_audience_suggestion: input.targetAudience
      }];
      console.log(`[${agentContext}] Using fallback ideas due to parse error.`);
    }

    // --- Store Proposed Topics in marketing.proposed_topics ---
    let storedCount = 0, duplicateCount = 0, errorCount = 0;
    for (const ideaSet of llmIdeas) {
      for (const angle of ideaSet.potential_blog_angles) {
        if (!angle || typeof angle !== 'string' || angle.trim() === "") { errorCount++; continue; }
        try {
          // Check for exact match (case-insensitive)
          const existingExact = await db.query.proposedTopics.findFirst({
            // Drizzle doesn't directly support lower() in where. Use sql.raw or a custom Drizzle function if needed.
            // For simplicity, we'll rely on the unique index with lower() on DB side.
            // where: eq(sql`lower(${proposedTopics.topicTitle})`, angle.toLowerCase()) // This might not work as expected
            // A robust way is to attempt insert and catch unique violation, or query with raw SQL.
          });
          // This check is not perfect without lower() in Drizzle query. Rely on DB constraint.

          const embedding = await generateGeminiEmbedding(angle, TaskType.SEMANTIC_SIMILARITY); // NEW - using SEMANTIC_SIMILARITY for comparing titles
          const similarTopics = await findSimilarTopicsWithPgVector(db, embedding, SIMILARITY_THRESHOLD, 1); // NEW - findSimilarTopicsWithPgVector now takes the db client as its first argument
          
          if (similarTopics.length > 0) {
            console.log(`[${agentContext}] Topic "${angle}" is semantically similar to "${similarTopics[0].topicTitle}" (similarity: ${similarTopics[0].similarity.toFixed(2)}). Skipping.`);
            duplicateCount++;
            continue;
          }

          await db.insert(proposedTopics).values({
            topicTitle: angle,
            topicEmbedding: embedding,
            sourceType: 'agent_innovator',
            sourceIdentifier: input.focusType === 'enriched_product_id' && associatedProductDbId 
                              ? `product_db_id:${associatedProductDbId}` 
                              : input.focusValue,
            status: 'proposed',
            associatedProductDbId: associatedProductDbId,
            notes: `Generated for app theme: ${ideaSet.application}. Audience: ${ideaSet.target_audience_suggestion || input.targetAudience}`,
            // SEO fields (searchVolume, keywordDifficulty, etc.) will be populated by other agents/processes
          }).execute();
          storedCount++;
          console.log(`[${agentContext}] Proposed topic: "${angle}"`)
        } catch (dbError: any) {
          if (dbError.message?.includes('unique_topic_title_lower_idx')) { // Check for our unique constraint
            console.warn(`[${agentContext}] Topic "${angle}" already exists (unique constraint violation). Skipping.`);
            duplicateCount++;
          } else {
            errorCount++; 
            console.error(`[${agentContext}] DB error for topic "${angle}":`, dbError);
          }
        }
      }
    }
    const message = `${storedCount} new topics proposed. ${duplicateCount} duplicates/similars skipped. ${errorCount} errors during DB ops.`;
    console.log(`[${agentContext}] Finished. ${message}`);
    return { success: true, message };

  } catch (error: any) {
    console.error(`[${agentContext}] CRITICAL InnovatorAgent ERROR. LLM Raw: "${rawLlmResponseText.substring(0,500)}". Error:`, error);
    try {
      // Log failure to proposed_topics for tracking
      await db.insert(proposedTopics).values({
        topicTitle: `FAILED_IDEAS_FOR: ${input.focusValue.substring(0,100)} @ ${new Date().toISOString()}`,
        topicEmbedding: Array(768).fill(0), // Updated to match new embedding dimensions
        sourceType: 'agent_innovator_failure', 
        sourceIdentifier: input.focusValue, 
        status: 'error_generation',
        notes: `Agent error: ${error.message.substring(0, 200)}. LLM Raw (partial): ${rawLlmResponseText.substring(0,200)}`,
        associatedProductDbId: associatedProductDbId, // If it was determined
      }).execute();
    } catch(e) { console.error("[InnovatorAgent] Failed to log critical generation error to proposed_topics", e); }
    return { success: false, message: `Innovator Agent critical failure: ${error.message}` };
  }
} 