import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { contentPipeline, agentConfigurations, productApplications, shopifySyncProducts, blogPosts } from '../../../../lib/db/schema';
import { eq, and, or, desc, asc, sql } from 'drizzle-orm';
import { runInnovatorAgent } from '../../../../lib/agents/innovator-agent';
import { ApplicationsAgent } from '../../../../lib/agents/applications-agent';
import { BlogOutlineAgent } from '../../../../lib/agents/blog-outline-agent';
import { BlogWriterAgent } from '../../../../lib/agents/blog-writer-agent';

// Default configuration for agents
const DEFAULT_AGENT_CONFIG = {
  model: 'openai' as const,
  temperature: 0.7,
  maxTokens: 3000,
  retries: 3,
};

export async function POST(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  const cronSecret = authHeader?.split(' ')[1];
  
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    console.warn('[Cron Pipeline] Unauthorized attempt to run cron job.');
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const timestamp = new Date().toISOString();
  console.log(`[Cron Pipeline ${timestamp}] Starting pipeline processing...`);

  try {
    let processedTasks = 0;
    const results = {
      productEnrichment: 0,
      blogIdeas: 0,
      blogOutlines: 0,
      sectionContent: 0,
      fullDrafts: 0,
      publishedBlogs: 0,
      errors: [] as string[]
    };

    // Initialize agents
    const applicationsAgent = new ApplicationsAgent(DEFAULT_AGENT_CONFIG);
    const blogOutlineAgent = new BlogOutlineAgent(DEFAULT_AGENT_CONFIG);
    const blogWriterAgent = new BlogWriterAgent(DEFAULT_AGENT_CONFIG);

    // --- Stage 0: Product Enrichment with ApplicationsAgent ---
    console.log('[Cron Pipeline] Stage 0: Product Enrichment');
    const productsNeedingEnrichment = await db.query.shopifySyncProducts.findMany({
      where: and(
        sql`NOT EXISTS (
          SELECT 1 FROM ${productApplications} 
          WHERE ${productApplications.productId} = ${shopifySyncProducts.id}
        )`
      ),
      orderBy: [desc(shopifySyncProducts.updated_at)],
      limit: 3 // Process fewer products for quality over quantity
    });

    for (const product of productsNeedingEnrichment) {
      try {
        console.log(`[Cron Pipeline] Enriching product ${product.id}: ${product.title}`);
        
        // Use ApplicationsAgent to discover real applications
        const applicationsResult = await applicationsAgent.execute(product);
        
        if (applicationsResult.success && applicationsResult.data) {
          // Insert enriched applications
          for (const app of applicationsResult.data) {
            await db.insert(productApplications).values({
              productId: product.id,
              application: app.application,
              description: app.useCase,
              targetAudience: 'Research Scientists',
              marketPotential: app.marketPotential?.toString() || 'medium',
              technicalComplexity: 'medium',
              industry: app.industry,
              useCase: app.useCase,
              creativity: app.creativity || 5,
              // Add the new fields from the ApplicationsAgent
              technicalDetails: `Market potential: ${app.marketPotential}/10, Creativity: ${app.creativity}/10`
            });
          }

          results.productEnrichment++;
          console.log(`[Cron Pipeline] ✅ Enriched product ${product.id} with ${applicationsResult.data.length} AI-generated applications`);
        } else {
          console.error(`[Cron Pipeline] ApplicationsAgent failed for product ${product.id}: ${applicationsResult.error}`);
          results.errors.push(`Product enrichment failed for ${product.id}: ${applicationsResult.error}`);
        }
      } catch (error) {
        console.error(`[Cron Pipeline] Error enriching product ${product.id}:`, error);
        results.errors.push(`Product enrichment failed for ${product.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // --- Stage 1: Generate Blog Ideas for Enriched Products ---
    console.log('[Cron Pipeline] Stage 1: Blog Ideas Generation');
    const enrichedProductsNeedingIdeas = await db.query.productApplications.findMany({
      where: sql`NOT EXISTS (
        SELECT 1 FROM ${contentPipeline} 
        WHERE ${contentPipeline.task_type} = 'blog_idea' 
        AND (${contentPipeline.data} ->> 'source_product_id')::integer = ${productApplications.productId}
      )`,
      orderBy: [desc(productApplications.created_at)],
      limit: 2 // Process fewer for quality
    });

    const processedProductIds = new Set();
    for (const application of enrichedProductsNeedingIdeas) {
      // Only process each product once per run
      if (processedProductIds.has(application.productId)) continue;
      processedProductIds.add(application.productId);

      try {
        console.log(`[Cron Pipeline] Generating blog ideas for enriched product ${application.productId}`);
        
        const result = await runInnovatorAgent({
          focusType: 'enriched_product_id',
          focusValue: application.productId.toString(),
          targetAudience: 'R&D Chemists and Process Engineers',
          numIdeasPerApplication: 2
        });

        if (result.success) {
          results.blogIdeas++;
          console.log(`[Cron Pipeline] ✅ Generated ideas for product ${application.productId}: ${result.message}`);
        } else {
          results.errors.push(`Blog idea generation failed for product ${application.productId}: ${result.message}`);
        }
      } catch (error) {
        console.error(`[Cron Pipeline] Error generating ideas for product ${application.productId}:`, error);
        results.errors.push(`Blog idea generation error for product ${application.productId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // --- Stage 2: Process Pending Blog Ideas to Outlines with BlogOutlineAgent ---
    console.log('[Cron Pipeline] Stage 2: Blog Outline Generation');
    const pendingIdeaTasks = await db.query.contentPipeline.findMany({
      where: and(
        eq(contentPipeline.task_type, 'blog_idea'),
        eq(contentPipeline.status, 'pending')
      ),
      orderBy: [asc(contentPipeline.created_at)],
      limit: 2 // Process fewer for quality
    });

    for (const task of pendingIdeaTasks) {
      try {
        console.log(`[Cron Pipeline] Processing blog idea ${task.id} -> creating AI outline`);
        
        // Update status to in_progress
        await db.update(contentPipeline)
          .set({ 
            status: 'in_progress',
            updated_at: new Date()
          })
          .where(eq(contentPipeline.id, task.id));

        // Get product and application data for the outline agent
        const ideaData = task.data as any;
        const productId = ideaData.source_product_id;
        
        if (!productId) {
          throw new Error('No product ID found in blog idea data');
        }

        // Fetch product and its best application
        const product = await db.query.shopifySyncProducts.findFirst({
          where: eq(shopifySyncProducts.id, productId)
        });

        const application = await db.query.productApplications.findFirst({
          where: eq(productApplications.productId, productId),
          orderBy: [desc(productApplications.creativity)] // Use most creative application
        });

        if (!product || !application) {
          throw new Error(`Product ${productId} or application not found`);
        }

        // Use BlogOutlineAgent to generate real outline
        const outlineResult = await blogOutlineAgent.execute(product, application, {
          targetAudience: task.target_audience || 'Chemical Engineers',
          tone: 'informative_overview',
          technicalDepth: 'intermediate',
          requestedWordCount: 1200
        });

        if (outlineResult.success && outlineResult.data) {
          // Create blog outline task with real AI-generated outline
          const outlineTask = await db.insert(contentPipeline).values({
            task_type: 'blog_outline',
            status: 'completed', // Mark as completed since we have the full outline
            title: `Outline: ${outlineResult.data.title}`,
            summary: outlineResult.data.hook,
            target_audience: outlineResult.data.targetAudience,
            data: {
              ...task.data,
              source_idea_task_id: task.id,
              ai_outline: outlineResult.data, // Store the complete AI outline
              product_id: productId,
              application_id: application.id
            },
            source_chunk_ids: task.source_chunk_ids,
            source_document_ids: task.source_document_ids,
            priority: task.priority
          }).returning();

          // Mark idea task as completed
          await db.update(contentPipeline)
            .set({ 
              status: 'completed',
              updated_at: new Date()
            })
            .where(eq(contentPipeline.id, task.id));

          results.blogOutlines++;
          console.log(`[Cron Pipeline] ✅ Created AI outline task ${outlineTask[0].id} from idea ${task.id}`);
          console.log(`[Cron Pipeline] Outline title: "${outlineResult.data.title}"`);
        } else {
          throw new Error(`BlogOutlineAgent failed: ${outlineResult.error}`);
        }
      } catch (error) {
        console.error(`[Cron Pipeline] Error processing idea task ${task.id}:`, error);
        
        // Mark task as failed
        await db.update(contentPipeline)
          .set({ 
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            updated_at: new Date()
          })
          .where(eq(contentPipeline.id, task.id));

        results.errors.push(`Blog outline creation failed for task ${task.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // --- Stage 3: Process Completed Outlines to Full Blog Posts with BlogWriterAgent ---
    console.log('[Cron Pipeline] Stage 3: Full Blog Generation');
    const completedOutlineTasks = await db.query.contentPipeline.findMany({
      where: and(
        eq(contentPipeline.task_type, 'blog_outline'),
        eq(contentPipeline.status, 'completed'),
        sql`NOT EXISTS (
          SELECT 1 FROM ${blogPosts} 
          WHERE ${blogPosts.title} = ${contentPipeline.title}
        )`
      ),
      orderBy: [asc(contentPipeline.completed_at)],
      limit: 1 // Process one at a time for quality
    });

    for (const outlineTask of completedOutlineTasks) {
      try {
        console.log(`[Cron Pipeline] Generating full blog from outline ${outlineTask.id}`);
        
        const outlineData = outlineTask.data as any;
        const aiOutline = outlineData.ai_outline;
        const productId = outlineData.product_id;
        const applicationId = outlineData.application_id;

        if (!aiOutline || !productId) {
          throw new Error('Missing AI outline or product data');
        }

        // Fetch product for BlogWriterAgent
        const product = await db.query.shopifySyncProducts.findFirst({
          where: eq(shopifySyncProducts.id, productId)
        });

        if (!product) {
          throw new Error(`Product ${productId} not found`);
        }

        // Use BlogWriterAgent to generate complete blog post
        const contentResult = await blogWriterAgent.execute(product, aiOutline);

        if (contentResult.success && contentResult.data) {
          // Create blog post in the database
          const blogPost = await db.insert(blogPosts).values({
            title: aiOutline.title,
            content: contentResult.data,
            productId: productId,
            applicationId: applicationId || null,
          }).returning();

          // Mark outline task as published
          await db.update(contentPipeline)
            .set({ 
              status: 'published',
              notes_for_review: `Published as blog post ID: ${blogPost[0].id}`,
              updated_at: new Date()
            })
            .where(eq(contentPipeline.id, outlineTask.id));

          results.fullDrafts++;
          results.publishedBlogs++;
          console.log(`[Cron Pipeline] ✅ Generated and published full blog post ${blogPost[0].id}: "${aiOutline.title}"`);
          console.log(`[Cron Pipeline] Word count: ${contentResult.data.split(' ').length} words`);
        } else {
          throw new Error(`BlogWriterAgent failed: ${contentResult.error}`);
        }
      } catch (error) {
        console.error(`[Cron Pipeline] Error generating full blog from outline ${outlineTask.id}:`, error);
        
        // Mark outline as failed
        await db.update(contentPipeline)
          .set({ 
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            updated_at: new Date()
          })
          .where(eq(contentPipeline.id, outlineTask.id));

        results.errors.push(`Full blog generation failed for outline ${outlineTask.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    processedTasks = results.productEnrichment + results.blogIdeas + results.blogOutlines + results.fullDrafts;

    console.log(`[Cron Pipeline ${new Date().toISOString()}] Processing complete:`, {
      processedTasks,
      ...results
    });

    return NextResponse.json({
      success: true,
      message: 'AI-powered pipeline processed successfully',
      timestamp,
      stats: {
        processedTasks,
        ...results,
        agentsUsed: ['ApplicationsAgent', 'InnovatorAgent', 'BlogOutlineAgent', 'BlogWriterAgent']
      }
    });

  } catch (error) {
    console.error("[Cron Pipeline] Critical error during pipeline processing:", error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Critical error processing pipeline', 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp
      },
      { status: 500 }
    );
  }
} 