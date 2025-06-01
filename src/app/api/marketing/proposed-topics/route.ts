import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { proposedTopics, shopifySyncProducts } from '../../../../lib/db/schema';
import { eq, and, or, desc, asc, isNull, ilike, sql, count, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { generateGeminiEmbedding, findSimilarTopicsWithPgVector } from '../../../../lib/ai/embedding-client';
import { TaskType } from '@google/generative-ai';

const SIMILARITY_THRESHOLD_API = 0.90; // Threshold for creating new topics via API

// --- Zod Schemas for API Payloads ---
const GetProposedTopicsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  status: z.string().optional(),
  sortBy: z.enum(['createdAt', 'priorityScore', 'updatedAt', 'topicTitle']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  searchTerm: z.string().optional(),
  associatedProductDbId: z.coerce.number().int().positive().optional(),
});

const CreateProposedTopicSchema = z.object({
  topicTitle: z.string().min(5, "Title must be at least 5 characters").max(250, "Title too long"),
  primaryKeyword: z.string().optional().nullable(),
  secondaryKeywords: z.array(z.string()).optional().nullable(),
  sourceType: z.string().default('manual_entry'),
  sourceIdentifier: z.string().optional().nullable(),
  status: z.enum(['proposed', 'approved_for_pipeline', 'rejected', 'archived']).default('proposed'),
  associatedProductDbId: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  priorityScore: z.number().min(0).max(10).optional().nullable(), // Example scale
  strategicTheme: z.string().optional().nullable(),
});

// --- GET Handler (List Proposed Topics) ---
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryValidation = GetProposedTopicsQuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!queryValidation.success) {
      return NextResponse.json({ error: "Invalid query parameters", details: queryValidation.error.format() }, { status: 400 });
    }
    const { limit, offset, status, sortBy, sortOrder, searchTerm, associatedProductDbId } = queryValidation.data;

    const whereClauses = [];
    if (status) whereClauses.push(eq(proposedTopics.status, status));
    if (associatedProductDbId) whereClauses.push(eq(proposedTopics.associatedProductDbId, associatedProductDbId));
    if (searchTerm) {
      whereClauses.push(or(
        ilike(proposedTopics.topicTitle, `%${searchTerm}%`),
        ilike(proposedTopics.primaryKeyword, `%${searchTerm}%`),
        ilike(proposedTopics.notes, `%${searchTerm}%`)
      ));
    }

    let orderByClause;
    switch (sortBy) {
        case 'priorityScore':
            orderByClause = sortOrder === 'asc' ? asc(proposedTopics.priorityScore) : desc(proposedTopics.priorityScore);
            break;
        case 'updatedAt':
            orderByClause = sortOrder === 'asc' ? asc(proposedTopics.updatedAt) : desc(proposedTopics.updatedAt);
            break;
        case 'topicTitle':
            orderByClause = sortOrder === 'asc' ? asc(proposedTopics.topicTitle) : desc(proposedTopics.topicTitle);
            break;
        case 'createdAt':
        default:
            orderByClause = sortOrder === 'asc' ? asc(proposedTopics.createdAt) : desc(proposedTopics.createdAt);
            break;
    }

    const topicsData = await db.query.proposedTopics.findMany({
      where: whereClauses.length > 0 ? and(...whereClauses) : undefined,
      orderBy: [orderByClause],
      limit: limit,
      offset: offset,
      with: {
        product: { columns: { title: true, handle: true } }, // Include associated product title and handle
        pipelineTask: { columns: { id: true, status: true, task_type: true } },
        blogPost: { columns: { id: true, title: true, slug: true } }
      }
    });

    const totalCountResult = await db.select({ count: count() })
      .from(proposedTopics)
      .where(whereClauses.length > 0 ? and(...whereClauses) : undefined);
    const totalCount = totalCountResult[0]?.count || 0;

    return NextResponse.json({
      success: true,
      topics: topicsData,
      totalCount,
      limit,
      offset,
      hasMore: (offset + topicsData.length) < totalCount,
    });

  } catch (error) {
    console.error('Failed to fetch proposed topics:', error);
    return NextResponse.json({ error: 'Failed to fetch proposed topics', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

// --- POST Handler (Create Proposed Topic) ---
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = CreateProposedTopicSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid input", details: validation.error.format() }, { status: 400 });
    }
    const { topicTitle, ...data } = validation.data;

    // Check for exact duplicate (case-insensitive via DB index)
    // Drizzle doesn't have a built-in lower() for inserts with onConflictDoNothing easily,
    // so we rely on the DB unique index `unique_topic_title_lower_idx`.
    // A pre-check can be done, but there's still a race condition window.

    const embedding = await generateGeminiEmbedding(topicTitle, TaskType.SEMANTIC_SIMILARITY);
    const similarTopics = await findSimilarTopicsWithPgVector(db, embedding, SIMILARITY_THRESHOLD_API, 1);

    if (similarTopics.length > 0) {
      return NextResponse.json({
        error: "Topic is too similar to an existing one",
        details: `Similar to: "${similarTopics[0].topicTitle}" (ID: ${similarTopics[0].id}, Similarity: ${similarTopics[0].similarity.toFixed(2)})`,
        similarTopicId: similarTopics[0].id
      }, { status: 409 }); // Conflict
    }

    const newTopic = await db.insert(proposedTopics).values({
      topicTitle,
      topicEmbedding: embedding,
      primaryKeyword: data.primaryKeyword,
      secondaryKeywords: data.secondaryKeywords,
      sourceType: data.sourceType,
      sourceIdentifier: data.sourceIdentifier,
      status: data.status,
      associatedProductDbId: data.associatedProductDbId,
      notes: data.notes,
      priorityScore: data.priorityScore ? data.priorityScore.toString() : null, // decimal stored as string
      strategicTheme: data.strategicTheme,
      updatedAt: new Date(), // Ensure updatedAt is set on creation too
    }).returning();

    return NextResponse.json({ success: true, topic: newTopic[0] }, { status: 201 });

  } catch (error: any) {
    console.error('Failed to create proposed topic:', error);
    if (error.message?.includes('unique_topic_title_lower_idx')) {
      return NextResponse.json({ error: 'Topic title already exists (case-insensitive).' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create proposed topic', details: error.message }, { status: 500 });
  }
} 