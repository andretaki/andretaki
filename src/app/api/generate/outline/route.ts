import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import {
  contentPipeline,
  shopifySyncProducts,
  productApplications,
  proposedTopics,
  agentConfigurations
} from '../../../../lib/db/schema';
import { BlogArchitectAgent } from '../../../../lib/agents/blog-architect-agent';
import { eq, and } from 'drizzle-orm';
import { GenerateOutlineSchema, formatZodError } from '../../../../lib/validations/api';

const DEFAULT_BASE_AGENT_CONFIG = { model: 'gemini' as const, temperature: 0.5, maxTokens: 8192, retries: 2 };

export async function POST(request: NextRequest) {
  let bodyForErrorLogging: any = {}; // For logging in case of early parse failure
  try {
    const rawBody = await request.json();
    bodyForErrorLogging = rawBody; // Capture for logging if validation fails
    const validation = GenerateOutlineSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json({ 
        success: false, 
        error: "Invalid input for outline generation", 
        details: formatZodError(validation.error) 
      }, { status: 400 });
    }
    const { pipelineTaskId } = validation.data;

    const topicTask = await db.query.contentPipeline.findFirst({
      where: and(eq(contentPipeline.id, pipelineTaskId), eq(contentPipeline.task_type, 'blog_idea'), eq(contentPipeline.status, 'completed'))
    });

    if (!topicTask) {
      return NextResponse.json({ success: false, error: `Completed blog idea task with ID ${pipelineTaskId} not found.` }, { status: 404 });
    }

    const topicTaskData = topicTask.data as any;
    const productDbId = topicTaskData.product_db_id;
    const applicationId = topicTaskData.application_id;
    const topicTitle = topicTaskData.topic_title;
    const topicDescription = topicTaskData.topic_description;

    if (!productDbId) {
      await db.update(contentPipeline).set({ status: 'failed', error_message: 'Missing product_db_id in task data.', updated_at: new Date() }).where(eq(contentPipeline.id, topicTask.id));
      return NextResponse.json({ success: false, error: 'Missing product_db_id in completed topic task data.' }, { status: 400 });
    }

    const productRecord = await db.query.shopifySyncProducts.findFirst({ where: eq(shopifySyncProducts.id, productDbId) });
    if (!productRecord) {
      await db.update(contentPipeline).set({ status: 'failed', error_message: `Product DB ID ${productDbId} not found.`, updated_at: new Date() }).where(eq(contentPipeline.id, topicTask.id));
      return NextResponse.json({ success: false, error: `Product DB ID ${productDbId} not found for outline generation.` }, { status: 404 });
    }

    // Create a new outline task
    const newOutlineTask = await db.insert(contentPipeline).values({
      task_type: 'blog_outline',
      status: 'in_progress',
      data: {
        source_topic_task_id: topicTask.id,
        product_db_id: productDbId,
        application_id: applicationId,
        topic_title: topicTitle,
        topic_description: topicDescription
      },
      created_at: new Date(),
      updated_at: new Date()
    }).returning();

    const outlineTask = newOutlineTask[0];

    const architectAgentConfigFromDb = await db.query.agentConfigurations.findFirst({where: eq(agentConfigurations.agent_type, 'blog_architect_agent')});
    const mappedArchitectConfig = architectAgentConfigFromDb ? {
        model: (architectAgentConfigFromDb.llm_model_name?.includes('gemini') ? 'gemini' : 'openai') as 'gemini' | 'openai',
        temperature: (architectAgentConfigFromDb.default_parameters as any)?.temperature || 0.6,
        maxTokens: (architectAgentConfigFromDb.default_parameters as any)?.max_tokens || 8192,
        retries: (architectAgentConfigFromDb.default_parameters as any)?.retries || 2,
        llm_model_name: architectAgentConfigFromDb.llm_model_name,
        base_prompt: architectAgentConfigFromDb.base_prompt
      } : { ...DEFAULT_BASE_AGENT_CONFIG, llm_model_name: 'gemini-1.5-pro-latest', base_prompt: '' };
      
    const blogArchitectAgent = new BlogArchitectAgent(mappedArchitectConfig as any);

    const outlineResult = await blogArchitectAgent.execute(productRecord, {
      topicTitle,
      topicDescription,
      applicationId: applicationId || undefined
    });

    if (outlineResult.success && outlineResult.data) {
      const aiOutline = outlineResult.data;
      
      await db.update(contentPipeline)
        .set({ 
          status: 'completed', 
          data: {
            ...outlineTask.data,
            ai_outline: aiOutline
          },
          completed_at: new Date(),
          updated_at: new Date()
        })
        .where(eq(contentPipeline.id, outlineTask.id));

      return NextResponse.json({ 
        success: true, 
        message: 'Blog outline generated successfully.',
        outlineTask: {
          id: outlineTask.id,
          title: `Outline: ${aiOutline.title}`
        }
      });

    } else {
      await db.update(contentPipeline)
        .set({ 
          status: 'failed', 
          error_message: (outlineResult.error || 'Blog architect agent failed').substring(0,500),
          updated_at: new Date()
        })
        .where(eq(contentPipeline.id, outlineTask.id));

      return NextResponse.json({ 
        success: false, 
        error: `BlogArchitectAgent failed: ${outlineResult.error || 'Unknown agent error'}` 
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Error in /api/generate/outline:', error);
    if (bodyForErrorLogging?.pipelineTaskId) {
      try {
        await db.update(contentPipeline)
          .set({ 
            status: 'failed', 
            error_message: `Unhandled API error: ${error.message.substring(0,450)}`,
            updated_at: new Date()
          })
          .where(eq(contentPipeline.id, Number(bodyForErrorLogging.pipelineTaskId)));
      } catch (dbError) {
        console.error("Failed to mark task as error during exception handling:", dbError);
      }
    }
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to generate blog outline', 
      details: error.message 
    }, { status: 500 });
  }
} 