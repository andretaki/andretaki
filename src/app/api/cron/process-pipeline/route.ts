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
import type { ShopifyMetafield } from '../../../../../lib/shopify'; // Assuming this type is correctly defined

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
    errors: [] as string[]
  };

  // --- STAGE 0: Product Enrichment ---
  console.log(`[Cron Pipeline] Stage 0: Product Enrichment (Limit: ${CRON_BATCH_LIMIT_ENRICHMENT})`);
  try {
    const productsNeedingEnrichment = await db.query.shopifySyncProducts.findMany({
      where: notExists(
        db.select({ id: productApplications.id })
          .from(productApplications)
          .where(eq(productApplications.productId, shopifySyncProducts.id))
      ),
      orderBy: [desc(shopifySyncProducts.updatedAtShopify)],
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
            results.errors.push(`Enrichment failed for product ${product.id}: ${applicationsResult.error || 'Unknown agent error'}`);
          }
        } catch (e: any) { results.errors.push(`Enrichment processing error for product ${product.id}: ${e.message}`); }
      }
    } else {
        console.log("[Cron Pipeline] Stage 0: No products found needing enrichment.");
    }
  } catch (e: any) { results.errors.push(`Stage 0 (Enrichment) DB query error: ${e.message}`); }

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
             results.errors.push(`InnovatorAgent failed for product ${productDbId}: ${innovatorResult.message}`);
          }
        } catch (e: any) { results.errors.push(`InnovatorAgent error for product ${productDbId}: ${e.message}`); }
      }
    } else {
        console.log("[Cron Pipeline] Stage 1: No products found needing topic proposals from InnovatorAgent.");
    }
  } catch (e: any) { results.errors.push(`Stage 1 (Topic Proposal) DB query error: ${e.message}`); }


  // --- STAGE 1.5: Promote 'Proposed' Topics to 'Blog Idea' in Content Pipeline ---
  // This stage assumes topics are manually or programmatically (by another agent) set to 'approved_for_pipeline'
  console.log(`[Cron Pipeline] Stage 1.5: Promote Approved Topics to Pipeline (Limit: ${CRON_BATCH_LIMIT_TOPIC_PROMOTION})`);
  try {
    const topicsToPromote = await db.query.proposedTopics.findMany({
      where: and(
        eq(proposedTopics.status, 'approved_for_pipeline'), // Only promote approved topics
        isNull(proposedTopics.contentPipelineTaskId)
      ),
      orderBy: [desc(proposedTopics.priorityScore), asc(proposedTopics.created_at)], // Highest priority first
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
              .set({ status: 'pipeline_active', contentPipelineTaskId: pipelineTask[0].id, updated_at: new Date() })
              .where(eq(proposedTopics.id, topic.id));
            results.topicsApprovedAndMovedToPipeline++;
            console.log(`[Cron Pipeline] ✅ Topic "${topic.topicTitle}" (ID ${topic.id}) moved to pipeline task ID ${pipelineTask[0].id}.`);
          } else throw new Error('Failed to create content_pipeline task.');
        } catch (e: any) {
          results.errors.push(`Topic promotion failed for ID ${topic.id}: ${e.message}`);
          await db.update(proposedTopics).set({ status: 'error_promotion', notes: `Err: ${e.message.substring(0,100)}` }).where(eq(proposedTopics.id, topic.id));
        }
      }
    } else {
        console.log("[Cron Pipeline] Stage 1.5: No 'approved_for_pipeline' topics found to move to pipeline.");
    }
  } catch (e: any) { results.errors.push(`Stage 1.5 (Topic Promotion) DB query error: ${e.message}`); }


  // --- STAGE 2: Process Pending Blog Ideas to Outlines ---
  console.log(`[Cron Pipeline] Stage 2: Blog Outline Generation (Limit: ${CRON_BATCH_LIMIT_OUTLINE_GENERATION})`);
  try {
    const pendingIdeaTasks = await db.query.contentPipeline.findMany({
      where: and(eq(contentPipeline.task_type, 'blog_idea'), eq(contentPipeline.status, 'pending')),
      orderBy: [desc(contentPipeline.priority), asc(contentPipeline.created_at)],
      limit: CRON_BATCH_LIMIT_OUTLINE_GENERATION
    });
    
    if (pendingIdeaTasks.length > 0) {
      const outlineAgentConfig = await db.query.agentConfigurations.findFirst({where: eq(agentConfigurations.agent_type, 'blog_outline_agent')});
      const mappedOutlineConfig = outlineAgentConfig ? {
        model: 'gemini' as const,
        temperature: 0.5,
        maxTokens: 4096,
        retries: 2,
        llm_model_name: outlineAgentConfig.llm_model_name,
        base_prompt: outlineAgentConfig.base_prompt
      } : { ...DEFAULT_BASE_AGENT_CONFIG, llm_model_name: 'gemini-1.5-pro-latest', base_prompt: '' };
      const blogOutlineAgent = new BlogOutlineAgent(mappedOutlineConfig);

      for (const task of pendingIdeaTasks) {
        try {
          await db.update(contentPipeline).set({ status: 'in_progress', updated_at: new Date() }).where(eq(contentPipeline.id, task.id));
          const ideaData = task.data as any;
          const productDbId = ideaData.source_product_db_id;

          if (!productDbId) {
            console.warn(`[Cron Pipeline] Blog Idea Task ${task.id} has no productDbId. Cannot generate product-specific outline. Mark as error or handle general themes.`);
            await db.update(contentPipeline).set({status: 'failed', error_message: 'Missing productDbId for outline.', updated_at: new Date()}).where(eq(contentPipeline.id, task.id));
            results.errors.push(`Outline failed for task ${task.id}: Missing productDbId`);
            continue;
          }

          const productRecord = await db.query.shopifySyncProducts.findFirst({ where: eq(shopifySyncProducts.id, productDbId) });
          const applicationRecord = await db.query.productApplications.findFirst({
            where: eq(productApplications.productId, productDbId),
            orderBy: [desc(productApplications.marketPotential), desc(productApplications.creativity)]
          });

          if (!productRecord || !applicationRecord) throw new Error(`Product (DB ID ${productDbId}) or its best application not found for task ${task.id}`);
          
          const outlineResult = await blogOutlineAgent.execute(productRecord, applicationRecord, {
            targetAudience: task.target_audience || 'Chemical Industry Professionals',
            // tone, technicalDepth, requestedWordCount can come from ideaData or defaults
          });

          if (outlineResult.success && outlineResult.data) {
            const validatedOutline: BlogOutline = outlineResult.data; // Already Zod validated by the agent
            await db.insert(contentPipeline).values({
              task_type: 'blog_outline', status: 'completed', // Outline is ready for writing stage
              title: `Outline: ${validatedOutline.title}`,
              summary: validatedOutline.hook, target_audience: validatedOutline.targetAudience,
              data: { // Carry over relevant data, add the new outline
                source_proposed_topic_id: ideaData.source_proposed_topic_id,
                source_idea_task_id: task.id, // Link to the parent idea task
                ai_outline: validatedOutline,
                product_db_id: productDbId,
                application_id: applicationRecord.id,
                primary_keyword: validatedOutline.seoElements.primaryKeyword, // From outline
                strategic_theme: ideaData.strategic_theme
              },
              related_pipeline_id: task.id,
              priority: task.priority, // Inherit priority
            }).returning();
            
            await db.update(contentPipeline).set({ status: 'completed', completed_at: new Date(), updated_at: new Date() }).where(eq(contentPipeline.id, task.id));
            results.blogOutlinesGenerated++;
            console.log(`[Cron Pipeline] ✅ Outline generated for idea task ${task.id}: "${validatedOutline.title}"`);
          } else {
            throw new Error(`BlogOutlineAgent failed: ${outlineResult.error || 'Unknown agent error'}`);
          }
        } catch (e: any) {
          results.errors.push(`Outline gen failed for idea task ${task.id}: ${e.message}`);
          await db.update(contentPipeline).set({ status: 'failed', error_message: e.message.substring(0,500), updated_at: new Date() }).where(eq(contentPipeline.id, task.id));
        }
      }
    } else {
        console.log("[Cron Pipeline] Stage 2: No pending 'blog_idea' tasks found for outline generation.");
    }
  } catch (e: any) { results.errors.push(`Stage 2 (Outline Gen) DB query error: ${e.message}`); }

  // --- STAGE 3: Process Completed Outlines to Full Blog Posts ---
  console.log(`[Cron Pipeline] Stage 3: Full Blog Generation (Limit: ${CRON_BATCH_LIMIT_BLOG_WRITING})`);
  try {
    const completedOutlineTasks = await db.query.contentPipeline.findMany({
      where: and(
        eq(contentPipeline.task_type, 'blog_outline'),
        eq(contentPipeline.status, 'completed'),
        // Ensure a blog post hasn't already been created from THIS specific outline task
        notExists(
          db.select({id: blogPosts.id}).from(blogPosts)
            .where(sql`${blogPosts.metadata}->>'source_outline_task_id' = ${contentPipeline.id.toString()}`) // Check metadata
        )
      ),
      orderBy: [desc(contentPipeline.priority), asc(contentPipeline.completed_at)],
      limit: CRON_BATCH_LIMIT_BLOG_WRITING
    });

    if (completedOutlineTasks.length > 0) {
      const writerAgentConfig = await db.query.agentConfigurations.findFirst({where: eq(agentConfigurations.agent_type, 'blog_writer_agent')});
      const mappedWriterConfig = writerAgentConfig ? {
        model: 'gemini' as const,
        temperature: 0.5,
        maxTokens: 4096,
        retries: 2,
        llm_model_name: writerAgentConfig.llm_model_name,
        base_prompt: writerAgentConfig.base_prompt
      } : { ...DEFAULT_BASE_AGENT_CONFIG, llm_model_name: 'gemini-1.5-pro-latest', base_prompt: '' };
      const blogWriterAgent = new BlogWriterAgent(mappedWriterConfig);

      for (const outlineTask of completedOutlineTasks) {
        try {
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
            const newBlogPost = await db.insert(blogPosts).values({
              title: aiOutline.title,
              content: contentResult.data, // This should be HTML from the agent
              productId: productDbId,
              applicationId: applicationId || null,
              slug: aiOutline.title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').substring(0, 250),
              outline: aiOutline,
              status: 'draft', // Default to draft, review process can publish
              metaDescription: aiOutline.seoElements.metaDescription,
              keywords: [aiOutline.seoElements.primaryKeyword, ...(aiOutline.seoElements.secondaryKeywords || [])],
              wordCount: contentResult.data.split(/\s+/).filter(Boolean).length,
              metadata: {
                source_outline_task_id: outlineTask.id.toString(),
                source_proposed_topic_id: outlineTaskData.source_proposed_topic_id?.toString(),
                targetAudience: aiOutline.targetAudience,
                blogTone: aiOutline.tone,
                technicalDepthLevel: aiOutline.technicalDepth,
                primary_keyword_from_outline: aiOutline.seoElements.primaryKeyword,
              }
            }).returning();

            await db.update(contentPipeline)
              .set({ status: 'published', notes_for_review: `Blog post ID: ${newBlogPost[0].id}`, completed_at: new Date(), updated_at: new Date() })
              .where(eq(contentPipeline.id, outlineTask.id));
            
            // Update proposed_topics status to published
            if (outlineTaskData.source_proposed_topic_id) {
                await db.update(proposedTopics)
                    .set({ status: 'published', finalBlogPostId: newBlogPost[0].id, updated_at: new Date()})
                    .where(eq(proposedTopics.id, Number(outlineTaskData.source_proposed_topic_id)));
            }
            results.fullDraftsWritten++;
            console.log(`[Cron Pipeline] ✅ Blog post written for outline task ${outlineTask.id}: "${aiOutline.title}" (DB ID: ${newBlogPost[0].id})`);
          } else {
            throw new Error(`BlogWriterAgent failed: ${contentResult.error || 'Unknown agent error'}`);
          }
        } catch (e: any) {
          results.errors.push(`Blog writing failed for outline task ${outlineTask.id}: ${e.message}`);
          await db.update(contentPipeline).set({ status: 'failed', error_message: e.message.substring(0,500), updated_at: new Date() }).where(eq(contentPipeline.id, outlineTask.id));
        }
      }
    } else {
        console.log("[Cron Pipeline] Stage 3: No completed 'blog_outline' tasks found for writing.");
    }
  } catch (e: any) { results.errors.push(`Stage 3 (Blog Writing) DB query error: ${e.message}`); }

  // --- Final Reporting ---
  const totalOperations = results.productEnrichment +
                         results.proposedNewTopicsByInnovator +
                         results.topicsApprovedAndMovedToPipeline +
                         results.blogOutlinesGenerated +
                         results.fullDraftsWritten;

  console.log(`[Cron Pipeline ${new Date().toISOString()}] Processing complete. Total operations: ${totalOperations}`, results);

  return NextResponse.json({
    success: true, message: 'AI content pipeline processed.', timestamp,
    stats: { totalOperations, ...results }
  });
} 