import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import {
  contentPipeline,
  agentConfigurations,
  productApplications,
  shopifySyncProducts, // This is rag_system.shopifySyncProducts
  blogPosts,
  proposedTopics,
  BlogOutline, // Zod schema type from db/schema
  Product as ShopifyProductType, // Type for shopifySyncProducts record
  ProductApplication as ProductApplicationType,
} from '../../../../lib/db/schema';
import { eq, and, or, desc, asc, sql, isNull, notExists, notInArray } from 'drizzle-orm';
import { runInnovatorAgent } from '../../../../lib/agents/innovator-agent';
import { ApplicationsAgent } from '../../../../lib/agents/applications-agent';
import { BlogOutlineAgent } from '../../../../lib/agents/blog-outline-agent';
import { BlogWriterAgent } from '../../../../lib/agents/blog-writer-agent';
import type { ShopifyMetafield } from '../../../../lib/shopify/client';

// Default configuration for agents if not found in DB
// Note: Individual agents might fetch their specific configs. This is a fallback.
const DEFAULT_BASE_AGENT_CONFIG = {
  model: 'gemini' as const, // Default to Gemini
  temperature: 0.5, // Generic temperature
  maxTokens: 4096,  // Reasonable default for Gemini
  retries: 2,
};

const CRON_BATCH_LIMIT_ENRICHMENT = 3;
const CRON_BATCH_LIMIT_TOPIC_PROPOSAL = 2;
const CRON_BATCH_LIMIT_TOPIC_PROMOTION = 5;
const CRON_BATCH_LIMIT_OUTLINE_GENERATION = 2;
const CRON_BATCH_LIMIT_BLOG_WRITING = 1;

// Helper to find metafield value (ensure this is robust for your metafield structure)
const findMetafieldValueInProductCron = (
  productMetafields: unknown,
  namespace: string,
  key: string
): string | undefined => {
  if (!productMetafields || !Array.isArray(productMetafields)) return undefined;
  const metafields = productMetafields as ShopifyMetafield[];
  const mf = metafields.find(m => m.namespace === namespace && m.key === key);
  if (!mf) return undefined;
  if (mf.type === 'json_string' && typeof mf.value === 'string') {
    try {
      // If value is a JSON string representation of a simple value, parse it
      const parsed = JSON.parse(mf.value);
      return String(parsed);
    } catch (e) {
      // If parsing fails but it's a string, return as is, or handle as error
      return String(mf.value);
    }
  }
  return String(mf.value);
};


export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = authHeader?.split(' ')[1];
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    console.warn('[Cron Pipeline] Unauthorized cron attempt.');
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const timestamp = new Date().toISOString();
  console.log(`[Cron Pipeline ${timestamp}] Starting pipeline processing... GOOGLE_AI_API is set.`);

  const results = {
    productEnrichment: 0,
    proposedNewTopicsByInnovator: 0,
    topicsApprovedAndMovedToPipeline: 0,
    blogOutlinesGenerated: 0,
    fullDraftsWritten: 0,
    errors: [] as { stage: string; taskId?: number; productId?: number; error: string }[]
  };

  // --- STAGE 0: Product Enrichment ---
  console.log(`[Cron Pipeline] Stage 0: Product Enrichment (Limit: ${CRON_BATCH_LIMIT_ENRICHMENT})`);
  try {
    const productsNeedingEnrichment = await db.query.shopifySyncProducts.findMany({
      where: and(
        notExists(
          db.select({id: productApplications.id})
            .from(productApplications)
            .where(eq(productApplications.productId, shopifySyncProducts.id))
        )
      ),
      orderBy: [desc(shopifySyncProducts.createdAtShopify)],
      limit: CRON_BATCH_LIMIT_ENRICHMENT
    });

    if (productsNeedingEnrichment.length > 0) {
      const appAgentConfig = await db.query.agentConfigurations.findFirst({where: eq(agentConfigurations.agent_type, 'applications_agent')});
      const mappedConfig = appAgentConfig ? {
        model: 'gemini' as const,
        temperature: 0.5,
        maxTokens: 4096,
        retries: 2,
        llm_model_name: appAgentConfig.llm_model_name,
        base_prompt: appAgentConfig.base_prompt
      } : { ...DEFAULT_BASE_AGENT_CONFIG, llm_model_name: 'gemini-1.5-pro-latest', base_prompt: '' };
      const applicationsAgent = new ApplicationsAgent(mappedConfig);

      for (const product of productsNeedingEnrichment) {
        try {
          console.log(`[Cron Pipeline] Enriching product DB ID ${product.id}: ${product.title}`);
          const applicationsResult = await applicationsAgent.execute(product);

          if (applicationsResult.success && applicationsResult.data) {
            for (const app of applicationsResult.data) {
              await db.insert(productApplications).values({
                productId: product.id,
                application: app.application, description: app.useCase,
                industry: app.industry, useCase: app.useCase, creativity: app.creativity,
                marketPotential: app.marketPotential?.toString(),
                technicalDetails: `Market potential: ${app.marketPotential}/10, Creativity: ${app.creativity}/10`,
                targetAudience: 'Research Scientists'
              }).onConflictDoNothing(); // Assuming no update needed if app for product exists
            }
            results.productEnrichment++;
            console.log(`[Cron Pipeline] ✅ Enriched product DB ID ${product.id} with ${applicationsResult.data.length} applications.`);
          } else {
            results.errors.push({ stage: "Stage 0: Enrichment", taskId: product.id, productId: product.id, error: applicationsResult.error || 'Unknown agent error' });
          }
        } catch (e: any) {
          results.errors.push({ stage: "Stage 0: Enrichment", taskId: product.id, productId: product.id, error: e.message });
        }
      }
    } else {
        console.log("[Cron Pipeline] Stage 0: No products found needing enrichment.");
    }
  } catch (e: any) {
    console.error(`[Cron Pipeline] Stage 0 DB query error: ${e.message}`);
    results.errors.push({ stage: "Stage 0: Enrichment DB Query", error: e.message });
  }

  // --- STAGE 1: Propose Blog Topics (via InnovatorAgent) ---
  console.log(`[Cron Pipeline] Stage 1: Propose Blog Topics (Limit: ${CRON_BATCH_LIMIT_TOPIC_PROPOSAL})`);
  try {
    const productsNeedingTopicProposals = await db
      .selectDistinct({ productDbId: productApplications.productId })
      .from(productApplications)
      .where(notExists(
          db.select({ id: proposedTopics.id}).from(proposedTopics)
          .where(and(
              eq(proposedTopics.associatedProductDbId, productApplications.productId),
              eq(proposedTopics.sourceType, 'agent_innovator')
          ))
      ))
      .orderBy(desc(productApplications.created_at))
      .limit(CRON_BATCH_LIMIT_TOPIC_PROPOSAL);

    if (productsNeedingTopicProposals.length > 0) {
      for (const { productDbId } of productsNeedingTopicProposals) {
        if (!productDbId) continue;
        try {
          console.log(`[Cron Pipeline] Proposing topics for product DB ID ${productDbId}`);
          // InnovatorAgent internally fetches its config or uses default.
          // Ensure its default or DB config points to a Gemini model if that's the intent.
          const innovatorResult = await runInnovatorAgent({
            focusType: 'enriched_product_id',
            focusValue: productDbId.toString(),
            targetAudience: 'R&D Chemists and Process Engineers', // Example
          });
          if (innovatorResult.success) {
             // Parse message for count if possible, e.g., "X new topics proposed."
            const match = innovatorResult.message?.match(/(\d+) new topics proposed/);
            results.proposedNewTopicsByInnovator += match ? parseInt(match[1]) : 1;
          } else {
             results.errors.push({ stage: "Stage 1: Topic Proposal", taskId: productDbId, productId: productDbId, error: innovatorResult.message || 'Unknown InnovatorAgent error' });
          }
        } catch (e: any) {
          results.errors.push({ stage: "Stage 1: Topic Proposal", taskId: productDbId, productId: productDbId, error: e.message });
        }
      }
    } else {
        console.log("[Cron Pipeline] Stage 1: No products found needing topic proposals from InnovatorAgent.");
    }
  } catch (e: any) {
    console.error(`[Cron Pipeline] Stage 1 DB query error: ${e.message}`);
    results.errors.push({ stage: "Stage 1: Topic Proposal DB Query", error: e.message });
  }


  // --- STAGE 1.5: Promote 'Proposed' Topics to 'Blog Idea' in Content Pipeline ---
  // This stage assumes topics are manually or programmatically (by another agent) set to 'approved_for_pipeline'
  console.log(`[Cron Pipeline] Stage 1.5: Promote Approved Topics to Pipeline (Limit: ${CRON_BATCH_LIMIT_TOPIC_PROMOTION})`);
  try {
    const topicsToPromote = await db.query.proposedTopics.findMany({
      where: and(
        eq(proposedTopics.status, 'approved_for_pipeline'), // Only promote approved topics
        isNull(proposedTopics.contentPipelineTaskId)
      ),
      orderBy: [desc(proposedTopics.priorityScore), asc(proposedTopics.createdAt)], // Highest priority first
      limit: CRON_BATCH_LIMIT_TOPIC_PROMOTION
    });

    if (topicsToPromote.length > 0) {
      for (const topic of topicsToPromote) {
        try {
          const productForTopic = topic.associatedProductDbId
            ? await db.query.shopifySyncProducts.findFirst({ where: eq(shopifySyncProducts.id, topic.associatedProductDbId)})
            : null;

          const pipelineTask = await db.insert(contentPipeline).values({
            task_type: 'blog_idea', status: 'pending', title: topic.topicTitle,
            summary: (topic.notes || `Topic for ${productForTopic?.title || 'general theme'}`).substring(0, 250),
            target_audience: productForTopic?.productType || 'Chemists', // More dynamic audience later
            data: {
              source_proposed_topic_id: topic.id,
              primary_keyword: topic.primaryKeyword,
              secondary_keywords: topic.secondaryKeywords,
              source_product_db_id: topic.associatedProductDbId,
              strategic_theme: topic.strategicTheme,
              serp_analysis_summary: topic.serpAnalysisSummary,
            },
            priority: topic.priorityScore ? Math.round(Number(topic.priorityScore)) : 0,
          }).returning();

          if (pipelineTask.length > 0) {
            await db.update(proposedTopics)
              .set({ status: 'pipeline_active', contentPipelineTaskId: pipelineTask[0].id, updatedAt: new Date() })
              .where(eq(proposedTopics.id, topic.id));
            results.topicsApprovedAndMovedToPipeline++;
            console.log(`[Cron Pipeline] ✅ Topic "${topic.topicTitle}" (ID ${topic.id}) moved to pipeline task ID ${pipelineTask[0].id}.`);
          } else throw new Error('Failed to create content_pipeline task.');
        } catch (e: any) {
          results.errors.push({ stage: "Stage 1.5: Topic Promotion", taskId: topic.id, productId: topic.associatedProductDbId, error: e.message });
          await db.update(proposedTopics)
            .set({ status: 'error_promotion', notes: `Err: ${e.message.substring(0,100)}`, updatedAt: new Date() })
            .where(eq(proposedTopics.id, topic.id));
        }
      }
    } else {
        console.log("[Cron Pipeline] Stage 1.5: No 'approved_for_pipeline' topics found to move to pipeline.");
    }
  } catch (e: any) {
    console.error(`[Cron Pipeline] Stage 1.5 DB query error: ${e.message}`);
    results.errors.push({ stage: "Stage 1.5: Topic Promotion DB Query", error: e.message });
  }


  // --- STAGE 2: Process Pending Blog Ideas to Outlines ---
  console.log(`[Cron Pipeline] Stage 2: Blog Outline Generation (Limit: ${CRON_BATCH_LIMIT_OUTLINE_GENERATION})`);
  try {
    const pendingIdeaTasks = await db.query.contentPipeline.findMany({
      where: and(eq(contentPipeline.task_type, 'blog_idea'), eq(contentPipeline.status, 'pending')),
      orderBy: [desc(contentPipeline.priority), asc(contentPipeline.created_at)],
      limit: CRON_BATCH_LIMIT_OUTLINE_GENERATION
    });
    
    if (pendingIdeaTasks.length > 0) {
      // Fetch BlogOutlineAgent configuration
      const outlineAgentConfig = await db.query.agentConfigurations.findFirst({
        where: eq(agentConfigurations.agent_type, 'blog_outline_agent')
      });

      // Configure the agent with DB settings or defaults
      const agentConfigForOutline = outlineAgentConfig ? {
        model: 'gemini' as const,
        temperature: (outlineAgentConfig.default_parameters as any)?.temperature || DEFAULT_BASE_AGENT_CONFIG.temperature,
        maxTokens: (outlineAgentConfig.default_parameters as any)?.maxTokens || DEFAULT_BASE_AGENT_CONFIG.maxTokens,
        retries: (outlineAgentConfig.default_parameters as any)?.retries || DEFAULT_BASE_AGENT_CONFIG.retries,
        llm_model_name: outlineAgentConfig.llm_model_name,
        base_prompt: outlineAgentConfig.base_prompt,
      } : { 
        ...DEFAULT_BASE_AGENT_CONFIG, 
        llm_model_name: 'gemini-2.5-pro-preview-05-06',
        base_prompt: '', // Agent will use its internal default
      };

      const blogOutlineAgent = new BlogOutlineAgent(agentConfigForOutline as any);

      for (const task of pendingIdeaTasks) {
        try {
          console.log(`[Cron Pipeline] Stage 2: Generating outline for idea task ID ${task.id}: "${task.title}"`);
          await db.update(contentPipeline).set({ status: 'in_progress', updated_at: new Date() }).where(eq(contentPipeline.id, task.id));
          
          const ideaData = task.data as any;
          let productDbId = ideaData.source_product_db_id;

          // If productDbId is not directly on the idea task, try to get it from the linked proposed_topic
          if (!productDbId && ideaData.source_proposed_topic_id) {
            const pTopic = await db.query.proposedTopics.findFirst({
              where: eq(proposedTopics.id, Number(ideaData.source_proposed_topic_id))
            });
            if (pTopic?.associatedProductDbId) {
              productDbId = pTopic.associatedProductDbId;
              console.log(`[Cron Pipeline] Stage 2: Found productDbId ${productDbId} from proposed_topic ${ideaData.source_proposed_topic_id} for task ${task.id}`);
            }
          }

          if (!productDbId) {
            throw new Error(`Missing productDbId for outline generation for idea task ${task.id}.`);
          }

          const productRecord = await db.query.shopifySyncProducts.findFirst({ where: eq(shopifySyncProducts.id, productDbId) });
          // Application record is optional for the agent; it can generate general outlines
          const applicationRecord = await db.query.productApplications.findFirst({
            where: eq(productApplications.productId, productDbId),
            orderBy: [desc(sql`CASE WHEN ${productApplications.marketPotential} ~ '^[0-9.]+$' THEN CAST(${productApplications.marketPotential} AS numeric) ELSE -1 END`), desc(productApplications.creativity)]
          });

          if (!productRecord) throw new Error(`Product (DB ID ${productDbId}) not found for task ${task.id}`);
          if (!applicationRecord) console.warn(`[Cron Pipeline] Stage 2: No specific application found for product DB ID ${productDbId} for task ${task.id}. Agent will generate a more general outline.`);
          
          const outlineResult = await blogOutlineAgent.execute(productRecord, applicationRecord!, {
            targetAudience: task.target_audience || 'Chemical Industry Professionals',
            tone: ideaData.tone,
            technicalDepth: ideaData.technicalDepth,
            requestedWordCount: ideaData.requestedWordCount,
          });

          if (outlineResult.success && outlineResult.data) {
            const validatedOutline: BlogOutline = outlineResult.data;
            const newOutlineTask = await db.insert(contentPipeline).values({
              task_type: 'blog_outline',
              status: 'completed',
              title: `Outline: ${validatedOutline.title}`,
              summary: validatedOutline.hook,
              target_audience: validatedOutline.targetAudience,
              keywords: [validatedOutline.seoElements.primaryKeyword, ...(validatedOutline.seoElements.secondaryKeywords || [])],
              data: {
                source_proposed_topic_id: ideaData.source_proposed_topic_id,
                source_idea_task_id: task.id,
                ai_outline: validatedOutline,
                product_db_id: productDbId,
                application_id: applicationRecord?.id || null,
                primary_keyword: validatedOutline.seoElements.primaryKeyword,
                strategic_theme: ideaData.strategic_theme || (productRecord.productType ? productRecord.productType.toLowerCase().replace(/\s+/g, '_') : 'general')
              },
              related_pipeline_id: task.id,
              priority: task.priority,
            }).returning();
            
            await db.update(contentPipeline).set({ status: 'completed', completed_at: new Date(), updated_at: new Date() }).where(eq(contentPipeline.id, task.id));
            results.blogOutlinesGenerated++;
            console.log(`[Cron Pipeline] ✅ Outline generated (Task ID ${newOutlineTask[0].id}) for idea task ${task.id}: "${validatedOutline.title}"`);
          } else {
            throw new Error(`BlogOutlineAgent failed: ${outlineResult.error || 'Unknown agent error during outline generation'}`);
          }
        } catch (e: any) {
          console.error(`[Cron Pipeline] Stage 2: Error generating outline for idea task ${task.id}: ${e.message}`);
          results.errors.push({ 
            stage: "Stage 2: Outline Gen", 
            taskId: task.id, 
            error: e.message.substring(0,500) 
          });
          await db.update(contentPipeline).set({ status: 'failed', error_message: e.message.substring(0,500), updated_at: new Date() }).where(eq(contentPipeline.id, task.id));
        }
      }
    } else {
      console.log("[Cron Pipeline] Stage 2: No pending 'blog_idea' tasks found for outline generation.");
    }
  } catch (e: any) {
    console.error(`[Cron Pipeline] Stage 2 DB query error: ${e.message}`);
    results.errors.push({ stage: "Stage 2: Outline Gen DB Query", error: e.message });
  }

  // --- STAGE 3: Process Completed Outlines to Full Blog Posts ---
  console.log(`[Cron Pipeline] Stage 3: Full Blog Generation (Limit: ${CRON_BATCH_LIMIT_BLOG_WRITING})`);
  try {
    const completedOutlineTasks = await db.query.contentPipeline.findMany({
      where: and(
        eq(contentPipeline.task_type, 'blog_outline'),
        eq(contentPipeline.status, 'completed'),
        notExists(
          db.select({id: blogPosts.id}).from(blogPosts)
            .where(sql`${blogPosts.metadata}->>'source_outline_task_id' = ${contentPipeline.id.toString()}`)
        )
      ),
      orderBy: [desc(contentPipeline.priority), asc(contentPipeline.created_at)],
      limit: CRON_BATCH_LIMIT_BLOG_WRITING
    });

    if (completedOutlineTasks.length > 0) {
      const writerAgentConfig = await db.query.agentConfigurations.findFirst({
        where: eq(agentConfigurations.agent_type, 'blog_writer_agent')
      });

      const agentConfigForWriter = writerAgentConfig ? {
        model: 'gemini' as const,
        temperature: (writerAgentConfig.default_parameters as any)?.temperature || DEFAULT_BASE_AGENT_CONFIG.temperature,
        maxTokens: (writerAgentConfig.default_parameters as any)?.maxTokens || DEFAULT_BASE_AGENT_CONFIG.maxTokens,
        retries: (writerAgentConfig.default_parameters as any)?.retries || DEFAULT_BASE_AGENT_CONFIG.retries,
        llm_model_name: writerAgentConfig.llm_model_name,
        base_prompt: writerAgentConfig.base_prompt,
      } : {
        ...DEFAULT_BASE_AGENT_CONFIG,
        llm_model_name: 'gemini-2.5-pro-preview-05-06',
        base_prompt: '', // Agent will use its internal default
      };

      const blogWriterAgent = new BlogWriterAgent(agentConfigForWriter as any);

      for (const outlineTask of completedOutlineTasks) {
        try {
          console.log(`[Cron Pipeline] Stage 3: Writing blog for outline task ID ${outlineTask.id}: "${outlineTask.title}"`);
          await db.update(contentPipeline).set({ status: 'in_progress', updated_at: new Date() }).where(eq(contentPipeline.id, outlineTask.id));
          
          const outlineTaskData = outlineTask.data as any;
          const aiOutline: BlogOutline | undefined = outlineTaskData.ai_outline;
          const productDbId = outlineTaskData.product_db_id;
          const applicationId = outlineTaskData.application_id;

          if (!aiOutline) throw new Error('Missing ai_outline in completed outline task data.');
          if (!productDbId) throw new Error('Missing product_db_id in completed outline task data.');

          const productRecord = await db.query.shopifySyncProducts.findFirst({ where: eq(shopifySyncProducts.id, productDbId) });
          if (!productRecord) throw new Error(`Product DB ID ${productDbId} not found for blog writing.`);

          const contentResult = await blogWriterAgent.execute(productRecord, aiOutline);

          if (contentResult.success && contentResult.data) {
            const newBlogPostArray = await db.insert(blogPosts).values({
              title: aiOutline.title,
              content: contentResult.data,
              productId: productDbId,
              applicationId: applicationId as number | null,
              slug: aiOutline.title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').substring(0, 250),
              outline: aiOutline,
              status: 'draft',
              metaDescription: aiOutline.seoElements.metaDescription,
              keywords: [aiOutline.seoElements.primaryKeyword, ...(aiOutline.seoElements.secondaryKeywords || [])],
              wordCount: contentResult.data.split(/\s+/).filter(Boolean).length,
              metadata: {
                source_outline_task_id: outlineTask.id.toString(),
                source_proposed_topic_id: outlineTaskData.source_proposed_topic_id?.toString(),
                source_idea_task_id: outlineTaskData.source_idea_task_id?.toString(),
                targetAudience: aiOutline.targetAudience,
                writerPersona: aiOutline.persona,
                blogTone: aiOutline.tone,
                technicalDepthLevel: aiOutline.technicalDepth,
                primary_keyword_from_outline: aiOutline.seoElements.primaryKeyword,
                strategic_theme: outlineTaskData.strategic_theme
              }
            }).returning();
            
            const newBlogPost = newBlogPostArray[0];

            await db.update(contentPipeline)
              .set({ status: 'published', notes_for_review: `Blog post ID: ${newBlogPost.id} created.`, completed_at: new Date(), updated_at: new Date() })
              .where(eq(contentPipeline.id, outlineTask.id));
            
            if (outlineTaskData.source_proposed_topic_id) {
              await db.update(proposedTopics)
                .set({ status: 'published', finalBlogPostId: newBlogPost.id, updatedAt: new Date() })
                .where(eq(proposedTopics.id, Number(outlineTaskData.source_proposed_topic_id)));
            }
            results.fullDraftsWritten++;
            console.log(`[Cron Pipeline] ✅ Blog post written (ID ${newBlogPost.id}) for outline task ${outlineTask.id}: "${aiOutline.title}"`);
          } else {
            throw new Error(`BlogWriterAgent failed: ${contentResult.error || 'Unknown agent error during content writing'}`);
          }
        } catch (e: any) {
          console.error(`[Cron Pipeline] Stage 3: Error writing blog for outline task ${outlineTask.id}: ${e.message}`);
          results.errors.push({ 
            stage: "Stage 3: Blog Writing", 
            taskId: outlineTask.id, 
            error: e.message.substring(0,500) 
          });
          await db.update(contentPipeline).set({ status: 'failed', error_message: e.message.substring(0,500), updated_at: new Date() }).where(eq(contentPipeline.id, outlineTask.id));
        }
      }
    } else {
      console.log("[Cron Pipeline] Stage 3: No completed 'blog_outline' tasks found for writing.");
    }
  } catch (e: any) {
    console.error(`[Cron Pipeline] Stage 3 DB query error: ${e.message}`);
    results.errors.push({ stage: "Stage 3: Blog Writing DB Query", error: e.message });
  }

  // --- Final Reporting ---
  const totalOperations = results.productEnrichment +
                         results.proposedNewTopicsByInnovator +
                         results.topicsApprovedAndMovedToPipeline +
                         results.blogOutlinesGenerated +
                         results.fullDraftsWritten;

  console.log(`[Cron Pipeline ${new Date().toISOString()}] Processing complete. Total operations: ${totalOperations}`, results);
  if (results.errors.length > 0) {
    console.warn(`[Cron Pipeline] Completed with ${results.errors.length} errors:`, results.errors);
  }

  return NextResponse.json({
    success: results.errors.length === 0,
    message: `AI content pipeline processed. Operations: ${totalOperations}. Errors: ${results.errors.length}.`,
    timestamp,
    stats: { totalOperations, ...results }
  });
} 