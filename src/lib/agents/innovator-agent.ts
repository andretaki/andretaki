import { db } from '../db';
import { agentConfigurations, contentPipeline, shopifySyncProducts, blogPosts, productApplications } from '../db/schema';
import { eq, ilike, or, and, sql, desc } from 'drizzle-orm';
import { type BlogIdeaData } from '../db/schema';

const APP_API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_URL || 'localhost:3000'}`;

interface InnovatorInput {
  focusType: 'enriched_product_id' | 'general_theme';
  focusValue: string; // Product ID string or theme string
  targetAudience: string;
  numIdeasPerApplication?: number; // Number of ideas per application (for product-focused generation)
}

export async function runInnovatorAgent(input: InnovatorInput) {
  console.log(`Innovator Agent started for: ${input.focusType} - ${input.focusValue}`);
  try {
    // 1. Fetch Agent Configuration
    const agentConfig = await db.query.agentConfigurations.findFirst({
      where: eq(agentConfigurations.agent_type, 'innovator')
    });
    if (!agentConfig || !agentConfig.base_prompt) throw new Error("Innovator agent configuration or base_prompt not found.");

    let ragContextString = "No specific RAG context retrieved for this focus.";
    let shopifyProductInfoString = "No specific product data loaded for this focus.";
    let product: typeof shopifySyncProducts.$inferSelect | undefined;
    let productApplications: typeof productApplications.$inferSelect[] = [];

    // 2. Gather Context based on focusType
    if (input.focusType === 'enriched_product_id') {
        // Find the product by internal database ID (not Shopify ID)
        product = await db.query.shopifySyncProducts.findFirst({
            where: eq(shopifySyncProducts.id, parseInt(input.focusValue))
        });
        if (!product) throw new Error(`Product with ID ${input.focusValue} not found.`);
        
        // Get enriched product applications
        productApplications = await db.query.productApplications.findMany({
            where: eq(productApplications.productId, product.id),
            limit: 10
        });
        
        shopifyProductInfoString = `Product: ${product.title}\nDescription: ${product.description?.substring(0, 200)}...\nTags: ${product.tags}\nCAS: ${product.casNumber}\nFormula: ${product.chemicalFormula}`;
        
        if (productApplications.length > 0) {
            shopifyProductInfoString += `\n\nEnriched Applications:\n${productApplications.map(app => 
                `- ${app.application}: ${app.description?.substring(0, 100)}...`
            ).join('\n')}`;
        }
        
        // For RAG integration, you'll need to implement the RAG client
        // const productRagQuery = `Detailed information, common questions, and unique applications for chemical product: ${product.title} (CAS: ${product.casNumber}) and its applications: ${productApplications.map(a => a.application).join(', ')}.`;
        // const ragResult = await ragApiClient.search(productRagQuery, 5);
        // if (ragResult.results.length > 0) {
        //     ragContextString = ragResult.results.map(c => `Source: ${c.source_document_name || 'General Info'}\nContent: ${c.content}`).join("\n\n---\n\n");
        // }

    } else { // general_theme
        // const genericRagQuery = `Potential applications, key considerations, and market trends for theme "${input.focusValue}" relevant to ${input.targetAudience}`;
        // const ragResult = await ragApiClient.search(genericRagQuery, 7);
        // if (ragResult.results.length > 0) {
        //    ragContextString = ragResult.results.map(c => `Source: ${c.source_document_name || 'General Info'}\nContent: ${c.content}`).join("\n\n---\n\n");
        // }

        // For general themes, we can still look for related products
        const relatedProducts = await db.query.shopifySyncProducts.findMany({
            where: or(
                ilike(shopifySyncProducts.title, `%${input.focusValue}%`),
                ilike(shopifySyncProducts.tags, `%${input.focusValue}%`),
                ilike(shopifySyncProducts.productType, `%${input.focusValue}%`)
            ),
            limit: 3
        });
        if (relatedProducts.length > 0) {
            shopifyProductInfoString = relatedProducts.map(p => `Product: ${p.title}\nDescription: ${p.description?.substring(0, 100)}...\nTags: ${p.tags}`).join("\n---\n");
        }
    }

    // 3. Fetch existing content titles to avoid duplicates
    const existingBlogTitles = (await db.select({ title: blogPosts.title }).from(blogPosts)
        .where(or(
            product ? eq(blogPosts.productId, product.id) : undefined, // If product specific, check its blogs
            ilike(blogPosts.title, `%${input.focusValue}%`) // General check
        ))
        .orderBy(desc(blogPosts.createdAt))
        .limit(50)
    ).map(r => r.title).filter(Boolean) as string[];

    const pendingIdeaTitles = (await db.select({ title: contentPipeline.title }).from(contentPipeline)
        .where(and(
            or(
                eq(contentPipeline.task_type, 'blog_idea'),
                eq(contentPipeline.task_type, 'blog_outline')
            ),
            product ? sql`${contentPipeline.data} ->> 'source_product_id' = ${product.id}` : undefined, // crude check if product_id is in data
            ilike(contentPipeline.title, `%${input.focusValue}%`)
        ))
        .limit(50)
    ).map(r => r.title).filter(Boolean) as string[];
    
    const allExistingTitles = [...new Set([...existingBlogTitles, ...pendingIdeaTitles])];

    // 4. Calculate total ideas to generate
    const numIdeasPerApp = input.numIdeasPerApplication || 2;
    const totalIdeas = input.focusType === 'enriched_product_id' && productApplications.length > 0 
        ? productApplications.length * numIdeasPerApp 
        : numIdeasPerApp;

    // 5. Construct LLM Prompt
    let llmPrompt = agentConfig.base_prompt
        .replace('{{NUM_IDEAS}}', totalIdeas.toString())
        .replace('{{FOCUS_VALUE}}', input.focusValue)
        .replace('{{TARGET_AUDIENCE}}', input.targetAudience)
        .replace('{{RAG_CONTEXT}}', ragContextString)
        .replace('{{SHOPIFY_PRODUCT_INFO}}', shopifyProductInfoString)
        .replace('{{EXISTING_CONTENT_TITLES}}', allExistingTitles.length > 0 ? allExistingTitles.join('\n - ') : 'N/A (Treat as clean slate for this focus value)');
    
    // Add specific context for enriched products
    if (input.focusType === 'enriched_product_id' && productApplications.length > 0) {
        llmPrompt += `\n\nSPECIAL INSTRUCTIONS: Generate ${numIdeasPerApp} blog ideas for EACH of the following applications:\n${productApplications.map(app => `- ${app.application}: ${app.description}`).join('\n')}\n\nEach idea should be specifically tailored to that application's use case and target audience needs.`;
    }
    
    // 6. Call Generic Text Generation API (using the new /api/generate/text structure)
    const llmParams = agentConfig.default_parameters || {};
    const generationResponse = await fetch(`${APP_API_BASE_URL}/api/generate/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: llmPrompt,
        model: agentConfig.llm_model_name, // Ensure this is a model your API supports
        ...llmParams // Spread default params like temperature, max_tokens
      }),
    });

    if (!generationResponse.ok) {
      const errorText = await generationResponse.text();
      console.error("Innovator Agent LLM Error:", errorText);
      throw new Error(`LLM generation failed: ${generationResponse.status} ${errorText}`);
    }
    const generationData = await generationResponse.json();
    
    // 7. Parse LLM Output (expecting an array of idea objects based on the new prompt)
    let ideas: BlogIdeaData[];
    try {
        // If the LLM is wrapped in a {"generatedText": "..."} structure by your API
        const rawJson = typeof generationData.generatedText === 'string' ? generationData.generatedText : JSON.stringify(generationData.generatedText);
        ideas = JSON.parse(rawJson); 
        if (!Array.isArray(ideas)) { // Ensure it's an array
            // If the model directly returns the array as the root of generatedText (unlikely with json_object mode for the model)
            // or if it returns an object with a key containing the array. Adjust based on actual API response.
            // For now, we assume the JSON string itself is the array.
            console.warn("LLM output was not an array as expected, attempting to find an array within the object.");
            const ideasArrayKey = Object.keys(ideas).find(key => Array.isArray((ideas as any)[key]));
            if (ideasArrayKey) {
                ideas = (ideas as any)[ideasArrayKey];
            } else {
                 throw new Error("LLM output was not a JSON array of ideas and no array found in object keys.");
            }
        }
    } catch (parseError) {
        console.error("Innovator Agent: Failed to parse LLM JSON output:", generationData.generatedText || generationData);
        throw new Error(`LLM output was not valid JSON or not the expected array structure. Error: ${parseError}`);
    }

    // 8. Store in marketing.content_pipeline
    let ideasStoredCount = 0;
    for (const idea of ideas) {
      if (!idea.suggested_title || !idea.core_concept) {
        console.warn("Innovator Agent: Skipping incomplete idea from LLM:", idea);
        continue;
      }
      const dataPayload: BlogIdeaData = {
        ...idea,
        source_focus: input.focusValue // Add the original focus value
      };

      await db.insert(contentPipeline)
        .values({
          task_type: 'blog_idea',
          status: 'pending',
          title: idea.suggested_title,
          summary: idea.core_concept,
          target_audience: idea.target_audience_segment || input.targetAudience,
          data: dataPayload,
          source_chunk_ids: [], // TODO: Map RAG chunk IDs if available and relevant per idea
          source_document_ids: [] // TODO: Map RAG doc IDs
        })
        .execute();
      ideasStoredCount++;
      console.log(`Innovator Agent: Stored blog idea - "${idea.suggested_title}"`);
    }

    const message = input.focusType === 'enriched_product_id' && productApplications.length > 0
        ? `${ideasStoredCount} ideas generated for ${productApplications.length} applications (${numIdeasPerApp} per application)`
        : `${ideasStoredCount} ideas generated for theme: ${input.focusValue}`;

    console.log(`Innovator Agent finished for: ${input.focusValue}. ${message}`);
    return { success: true, message };

  } catch (error: any) {
    console.error(`Innovator Agent Error for ${input.focusValue}:`, error);
    return { success: false, message: error.message };
  }
} 