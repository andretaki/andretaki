import { db } from '../db';
import { agentConfigurations, contentPipeline, shopifySyncProducts } from '../db/schema';
import { eq, sql, ilike, or } from 'drizzle-orm';

const APP_API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_URL}`;

interface InnovatorInput {
  focusType: 'chemical' | 'product_category' | 'general_theme';
  focusValue: string;
  targetAudience: string;
  numIdeasPerApplication?: number; 
}

interface BlogIdea {
  application: string;
  potential_blog_angles: string[];
  target_audience_suggestion?: string;
}

const DEFAULT_INNOVATOR_CONFIG = {
  llm_model_name: 'gemini-2.5-pro-preview-05-06',
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
    max_tokens: 8000
  }
};

// Regex to extract JSON array, allows for some surrounding text.
// It looks for the outermost square brackets that contain objects.
const JSON_ARRAY_REGEX = /\[\s*(\{[\s\S]*?\})\s*(,\s*\{[\s\S]*?\})*\s*\]/;

export async function runInnovatorAgent(input: InnovatorInput) {
  const agentContext = `InnovatorAgent for focusValue="${input.focusValue}", type="${input.focusType}"`;
  console.log(`[${agentContext}] Started.`);
  let rawLlmResponseText = "LLM call did not complete or returned no text.";

  try {
    const agentConfigFromDb = await db.query.agentConfigurations.findFirst({
      where: eq(agentConfigurations.agent_type, 'innovator')
    });
    
    const agentConfig = agentConfigFromDb || DEFAULT_INNOVATOR_CONFIG;
    
    if (!agentConfigFromDb) {
      console.log(`[${agentContext}] No DB config found, using default Innovator Agent config.`);
    }

    const ragQuery = `Potential applications, key considerations, and interesting facts about ${input.focusValue} relevant to ${input.targetAudience}`;
    console.log(`[${agentContext}] Performing RAG query: "${ragQuery}"`);
    const ragResponse = await fetch(`${APP_API_BASE_URL}/api/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: ragQuery, topK: 3 }),
    });

    let ragContextString = "No specific RAG context available for this focus.";
    if (ragResponse.ok) {
      const ragData = await ragResponse.json();
      const ragContextChunks: any[] = ragData.chunks || [];
      if (ragContextChunks.length > 0) {
        ragContextString = ragContextChunks.map(c => `Source: ${c.document_name || 'Unknown Source'}\nContent Snippet: ${c.content.substring(0, 250)}...`).join("\n\n---\n\n");
        console.log(`[${agentContext}] RAG context fetched (${ragContextChunks.length} chunks).`);
      } else {
        console.log(`[${agentContext}] RAG query successful but returned no chunks.`);
      }
    } else {
      console.warn(`[${agentContext}] RAG query failed (Status: ${ragResponse.status}, Body: ${await ragResponse.text()}). Proceeding without RAG context.`);
    }
    
    let shopifyProductInfoString = "No specific product data directly matching focus value found.";
    if (input.focusType === 'chemical' || input.focusType === 'product_category') {
        console.log(`[${agentContext}] Querying Shopify products for focusValue: "${input.focusValue}"`);
        const products = await db.query.shopifySyncProducts.findMany({
            where: or(
                ilike(shopifySyncProducts.title, `%${input.focusValue}%`),
                ilike(shopifySyncProducts.tags, `%${input.focusValue}%`),
                ilike(shopifySyncProducts.productType, `%${input.focusValue}%`)
            ),
            limit: 2
        });
        if (products.length > 0) {
            shopifyProductInfoString = products.map(p => `Product: ${p.title}\nDescription: ${p.description?.substring(0, 100)}...\nTags: ${p.tags}`).join("\n---\n");
            console.log(`[${agentContext}] Found ${products.length} Shopify products for context.`);
        } else {
            console.log(`[${agentContext}] No Shopify products found matching "${input.focusValue}".`);
        }
    }
    
    let llmPrompt = agentConfig.base_prompt
        .replace(new RegExp('{{FOCUS_VALUE}}', 'g'), input.focusValue)
        .replace(new RegExp('{{TARGET_AUDIENCE}}', 'g'), input.targetAudience)
        .replace('{{RAG_CONTEXT}}', ragContextString)
        .replace('{{SHOPIFY_PRODUCT_INFO}}', shopifyProductInfoString);
    
    const llmParams = agentConfig.default_parameters || {};
    console.log(`[${agentContext}] Calling LLM via /api/generate/text. Model: ${agentConfig.llm_model_name}. Prompt length: ${llmPrompt.length}.`);

    const generationApiResponse = await fetch(`${APP_API_BASE_URL}/api/generate/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: llmPrompt,
        model: agentConfig.llm_model_name,
        ...llmParams
      }),
    });

    const generationApiResult = await generationApiResponse.json();

    if (!generationApiResponse.ok || !generationApiResult.success) {
      rawLlmResponseText = generationApiResult.generatedText || generationApiResult.details || "LLM API call itself reported failure.";
      console.error(`[${agentContext}] LLM /api/generate/text call FAILED. Status: ${generationApiResponse.status}. API Result:`, generationApiResult);
      throw new Error(`LLM generation failed: ${generationApiResult.error || rawLlmResponseText}`);
    }
    
    rawLlmResponseText = generationApiResult.generatedText;
    console.log(`[${agentContext}] Raw LLM Response Text Received:`, `"${rawLlmResponseText}"`);
    
    let ideas: BlogIdea[];
    try {
      if (!rawLlmResponseText || rawLlmResponseText.trim() === "") {
        console.warn(`[${agentContext}] LLM returned an empty or whitespace-only string from /api/generate/text.`);
        throw new Error("Empty or whitespace-only LLM response received by agent.");
      }

      let textToParse = rawLlmResponseText.trim();
      
      const match = textToParse.match(JSON_ARRAY_REGEX);
      if (match && match[0]) {
        textToParse = match[0];
        console.log(`[${agentContext}] Extracted JSON candidate via regex: "${textToParse}"`);
      } else {
        textToParse = textToParse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
        textToParse = textToParse.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
        console.log(`[${agentContext}] Text after basic cleaning (no regex match for array): "${textToParse}"`);
      }

      if (!textToParse.startsWith('[') || !textToParse.endsWith(']')) {
        console.warn(`[${agentContext}] Text for parsing does not appear to be a JSON array after cleaning: "${textToParse}"`);
        if (textToParse.startsWith('{') && textToParse.endsWith('}')) {
            console.warn(`[${agentContext}] Attempting to parse as single object and wrap in array.`);
            const singleObject = JSON.parse(textToParse);
            ideas = [singleObject];
        } else {
            throw new Error("LLM response is not in the expected JSON array or object format after cleaning.");
        }
      } else {
        ideas = JSON.parse(textToParse);
      }
        
      if (!Array.isArray(ideas)) {
        console.warn(`[${agentContext}] Parsed response was not an array, wrapping it. Parsed:`, ideas);
        ideas = [ideas];
      }
      
      if (ideas.length === 0 || !ideas.every(idea => idea.application && idea.potential_blog_angles && Array.isArray(idea.potential_blog_angles))) {
        console.warn(`[${agentContext}] Parsed JSON has invalid idea structure or is empty array. Ideas:`, ideas);
        throw new Error("Invalid idea structure in parsed JSON or empty array returned.");
      }
      
      console.log(`[${agentContext}] Successfully parsed ${ideas.length} blog idea sets.`);
        
    } catch (parseError) {
      console.error(`[${agentContext}] Failed to parse LLM JSON output. Raw text from /api/generate/text was: "${rawLlmResponseText}"`);
      console.error(`[${agentContext}] Parse error details:`, parseError);
      
      const fallbackApplication = `${input.focusValue} - Key Topics (Fallback)`;
      ideas = [{
        application: fallbackApplication,
        potential_blog_angles: [
          `Comprehensive Guide to ${input.focusValue} for ${input.targetAudience}`,
          `Exploring Applications of ${input.focusValue} in Various Industries`,
          `Safety, Handling, and Best Practices for ${input.focusValue}`,
          `The Future of ${input.focusValue}: Innovations, Research, and Market Trends`,
          `Troubleshooting and Optimizing Processes with ${input.focusValue}`
        ],
        target_audience_suggestion: input.targetAudience
      }];
      console.log(`[${agentContext}] Using fallback ideas due to parse error or empty/invalid LLM response.`);
    }

    let storedCount = 0;
    for (const idea of ideas) {
      if (!idea.application || !idea.potential_blog_angles) {
        console.warn(`[${agentContext}] Skipping invalid idea structure during DB insertion:`, idea);
        continue;
      }
      for (const angle of idea.potential_blog_angles) {
        await db.insert(contentPipeline)
          .values({
            task_type: 'blog_idea',
            status: 'pending',
            title: angle,
            summary: idea.application,
            target_audience: idea.target_audience_suggestion || input.targetAudience,
            data: {
                original_application: idea.application,
                suggested_title: angle,
                key_points_suggestion: [],
                source_focus: input.focusValue,
                focus_type: input.focusType
            },
          })
          .execute();
        console.log(`[${agentContext}] Stored blog idea: "${angle}"`);
        storedCount++;
      }
    }
    console.log(`[${agentContext}] Finished. Stored ${storedCount} blog angles.`);
    return { success: true, message: `${storedCount} blog angles processed and stored.` };

  } catch (error: any) {
    console.error(`[${agentContext}] CRITICAL ERROR. Raw LLM text was: "${rawLlmResponseText}". Error:`, error);
    try {
        await db.insert(contentPipeline).values({
            task_type: 'blog_idea_generation_failed',
            status: 'error',
            title: `Failed to generate ideas for ${input.focusValue}`,
            summary: `Agent error: ${error.message.substring(0, 250)}`,
            target_audience: input.targetAudience,
            data: { 
                focusType: input.focusType, 
                focusValue: input.focusValue, 
                error: error.message, 
                raw_llm_response: rawLlmResponseText.substring(0,1000) 
            },
        }).execute();
        console.log(`[${agentContext}] Logged failure task to content_pipeline.`);
    } catch (dbError) {
        console.error(`[${agentContext}] Failed to log failure task to DB:`, dbError);
    }
    return { success: false, message: `Innovator Agent failed: ${error.message}` };
  }
} 