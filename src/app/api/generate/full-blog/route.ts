import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import {
  contentPipeline,
  shopifySyncProducts,
  productApplications,
  blogPosts,
  proposedTopics,
  BlogOutline,
  agentConfigurations,
  type BlogMetadata
} from '../../../../lib/db/schema';
import { BlogWriterAgent } from '../../../../lib/agents/blog-writer-agent';
import { eq, and, sql } from 'drizzle-orm';
import { GenerateFullBlogSchema, formatZodError } from '../../../../lib/validations/api';

const DEFAULT_BASE_AGENT_CONFIG = { model: 'gemini' as const, temperature: 0.5, maxTokens: 8192, retries: 2 };

export async function POST(request: NextRequest) {
  let bodyForErrorLogging: any = {}; // For logging in case of early parse failure
  try {
    const rawBody = await request.json();
    bodyForErrorLogging = rawBody; // Capture for logging if validation fails
    const validation = GenerateFullBlogSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json({ 
        success: false, 
        error: "Invalid input for full blog generation", 
        details: formatZodError(validation.error) 
      }, { status: 400 });
    }
    const { outlineTaskId } = validation.data;

    const outlineTask = await db.query.contentPipeline.findFirst({
      where: and(eq(contentPipeline.id, outlineTaskId), eq(contentPipeline.task_type, 'blog_outline'), eq(contentPipeline.status, 'completed'))
    });

    if (!outlineTask) {
      return NextResponse.json({ success: false, error: `Completed blog outline task with ID ${outlineTaskId} not found.` }, { status: 404 });
    }
    
    const existingBlogPost = await db.query.blogPosts.findFirst({
        where: sql`${blogPosts.metadata}->>'source_outline_task_id' = ${outlineTask.id.toString()}`
    });

    if (existingBlogPost) {
        console.log(`[API Generate Full Blog] Blog post ${existingBlogPost.id} already exists for outline task ${outlineTask.id}. Returning existing.`);
        return NextResponse.json({ success: true, message: 'Blog post already exists.', blogPost: existingBlogPost });
    }

    await db.update(contentPipeline).set({ status: 'in_progress', updated_at: new Date() }).where(eq(contentPipeline.id, outlineTask.id));

    const outlineTaskData = outlineTask.data as any;
    const aiOutline: BlogOutline | undefined = outlineTaskData.ai_outline;
    const productDbId = outlineTaskData.product_db_id;
    const applicationId = outlineTaskData.application_id;

    if (!aiOutline) {
      await db.update(contentPipeline).set({ status: 'failed', error_message: 'Missing ai_outline in task data.', updated_at: new Date() }).where(eq(contentPipeline.id, outlineTask.id));
      return NextResponse.json({ success: false, error: 'Missing ai_outline in completed outline task data.' }, { status: 400 });
    }
    if (!productDbId) {
      await db.update(contentPipeline).set({ status: 'failed', error_message: 'Missing product_db_id in task data.', updated_at: new Date() }).where(eq(contentPipeline.id, outlineTask.id));
      return NextResponse.json({ success: false, error: 'Missing product_db_id in completed outline task data.' }, { status: 400 });
    }

    const productRecord = await db.query.shopifySyncProducts.findFirst({ where: eq(shopifySyncProducts.id, productDbId) });
    if (!productRecord) {
      await db.update(contentPipeline).set({ status: 'failed', error_message: `Product DB ID ${productDbId} not found.`, updated_at: new Date() }).where(eq(contentPipeline.id, outlineTask.id));
      return NextResponse.json({ success: false, error: `Product DB ID ${productDbId} not found for blog writing.` }, { status: 404 });
    }

    const writerAgentConfigFromDb = await db.query.agentConfigurations.findFirst({where: eq(agentConfigurations.agent_type, 'blog_writer_agent')});
    const mappedWriterConfig = writerAgentConfigFromDb ? {
        model: (writerAgentConfigFromDb.llm_model_name?.includes('gemini') ? 'gemini' : 'openai') as 'gemini' | 'openai',
        temperature: (writerAgentConfigFromDb.default_parameters as any)?.temperature || 0.6,
        maxTokens: (writerAgentConfigFromDb.default_parameters as any)?.max_tokens || 8192,
        retries: (writerAgentConfigFromDb.default_parameters as any)?.retries || 2,
        llm_model_name: writerAgentConfigFromDb.llm_model_name,
        base_prompt: writerAgentConfigFromDb.base_prompt
      } : { ...DEFAULT_BASE_AGENT_CONFIG, llm_model_name: 'gemini-1.5-pro-latest', base_prompt: '' };
      
    const blogWriterAgent = new BlogWriterAgent(mappedWriterConfig as any);

    const metadata: BlogMetadata = {
      source_outline_task_id: outlineTask.id.toString(),
      source_proposed_topic_id: outlineTaskData.source_proposed_topic_id?.toString(),
      source_idea_task_id: outlineTaskData.source_idea_task_id?.toString(),
      targetAudience: outlineTaskData.target_audience || aiOutline.targetAudience || "Research Scientists",
      writerPersona: outlineTaskData.writer_persona,
      blogTone: aiOutline.tone,
      technicalDepthLevel: aiOutline.technicalDepth,
      primary_keyword_from_outline: aiOutline.seoElements.primaryKeyword,
      strategic_theme: outlineTaskData.strategic_theme,
      custom_notes: outlineTaskData.custom_notes
    };

    const contentResult = await blogWriterAgent.execute(productRecord, aiOutline, metadata);

    if (contentResult.success && contentResult.data) {
      const blogContent = contentResult.data;
      const newBlogPost = await db.insert(blogPosts).values({
        productId: productDbId,
        applicationId: applicationId,
        title: aiOutline.title,
        slug: aiOutline.title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').substring(0, 250),
        outline: aiOutline,
        content: blogContent,
        status: 'draft',
        metaDescription: aiOutline.seoElements.metaDescription,
        keywords: [aiOutline.seoElements.primaryKeyword, ...aiOutline.seoElements.secondaryKeywords],
        wordCount: blogContent.split(/\s+/).length,
        metadata
      }).returning();

      const newBlogPostObj = newBlogPost[0];

      await db.update(contentPipeline)
        .set({ status: 'published', notes_for_review: `Blog post ID: ${newBlogPostObj.id}`, completed_at: new Date(), updated_at: new Date() })
        .where(eq(contentPipeline.id, outlineTask.id));
      
      if (outlineTaskData.source_proposed_topic_id) {
        await db.update(proposedTopics)
          .set({ status: 'published', finalBlogPostId: newBlogPostObj.id, updatedAt: new Date()})
          .where(eq(proposedTopics.id, Number(outlineTaskData.source_proposed_topic_id)));
      }
      
      return NextResponse.json({ success: true, message: 'Blog post generated.', blogPost: newBlogPostObj });
    } else {
      await db.update(contentPipeline).set({ status: 'failed', error_message: (contentResult.error || 'Blog writer agent failed').substring(0,500), updated_at: new Date() }).where(eq(contentPipeline.id, outlineTask.id));
      return NextResponse.json({ success: false, error: `BlogWriterAgent failed: ${contentResult.error || 'Unknown agent error'}` }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Error in /api/generate/full-blog:', error);
    if (bodyForErrorLogging?.outlineTaskId) {
      try {
        await db.update(contentPipeline)
          .set({ status: 'failed', error_message: `Unhandled API error: ${error.message.substring(0,450)}`, updated_at: new Date() })
          .where(eq(contentPipeline.id, Number(bodyForErrorLogging.outlineTaskId)));
      } catch (dbError) {
        console.error("Failed to mark task as error during exception handling:", dbError);
      }
    }
    return NextResponse.json({ success: false, error: 'Failed to generate full blog post', details: error.message }, { status: 500 });
  }
} 