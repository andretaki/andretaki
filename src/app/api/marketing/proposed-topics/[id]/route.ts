import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { proposedTopics } from '../../../../../lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { generateGeminiEmbedding, findSimilarTopicsWithPgVector } from '../../../../../lib/ai/embedding-client';
import { TaskType } from '@google/generative-ai';

const SIMILARITY_THRESHOLD_API = 0.90;

const UpdateProposedTopicSchema = z.object({
  topicTitle: z.string().min(5).max(250).optional(),
  primaryKeyword: z.string().optional().nullable(),
  secondaryKeywords: z.array(z.string()).optional().nullable(),
  status: z.enum(['proposed', 'approved_for_pipeline', 'pipeline_active', 'published', 'rejected', 'archived', 'error_promotion', 'error_generation']).optional(),
  associatedProductDbId: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  rejectionReason: z.string().optional().nullable(),
  priorityScore: z.number().min(0).max(10).optional().nullable(),
  strategicTheme: z.string().optional().nullable(),
  searchVolume: z.number().int().optional().nullable(),
  keywordDifficulty: z.number().int().optional().nullable(),
});

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const topicId = parseInt(params.id);

  if (isNaN(topicId)) {
    return NextResponse.json({ error: "Invalid Topic ID in path" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const validation = UpdateProposedTopicSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid input", details: validation.error.format() }, { status: 400 });
    }
    
    const dataToUpdate = { ...validation.data }; // Clone to modify

    if (Object.keys(dataToUpdate).length === 0) {
      return NextResponse.json({ error: "No fields to update provided" }, { status: 400 });
    }

    const updatePayload: Partial<typeof proposedTopics.$inferInsert> = {};

    // If topicTitle is updated, re-generate embedding and check for new conflicts
    if (dataToUpdate.topicTitle) {
      const newEmbedding = await generateGeminiEmbedding(dataToUpdate.topicTitle, TaskType.SEMANTIC_SIMILARITY);
      const similarTopics = await findSimilarTopicsWithPgVector(db, newEmbedding, SIMILARITY_THRESHOLD_API, 1, topicId); // Exclude self

      if (similarTopics.length > 0) {
        return NextResponse.json({
          error: "Updated topic title is too similar to another existing topic",
          details: `Similar to: "${similarTopics[0].topicTitle}" (ID: ${similarTopics[0].id}, Similarity: ${similarTopics[0].similarity.toFixed(2)})`,
          similarTopicId: similarTopics[0].id
        }, { status: 409 });
      }
      updatePayload.topicEmbedding = newEmbedding;
      updatePayload.topicTitle = dataToUpdate.topicTitle;
    }
    
    // Assign other validated fields
    if (dataToUpdate.primaryKeyword !== undefined) updatePayload.primaryKeyword = dataToUpdate.primaryKeyword;
    if (dataToUpdate.secondaryKeywords !== undefined) updatePayload.secondaryKeywords = dataToUpdate.secondaryKeywords;
    if (dataToUpdate.status !== undefined) updatePayload.status = dataToUpdate.status;
    if (dataToUpdate.associatedProductDbId !== undefined) updatePayload.associatedProductDbId = dataToUpdate.associatedProductDbId;
    if (dataToUpdate.notes !== undefined) updatePayload.notes = dataToUpdate.notes;
    if (dataToUpdate.rejectionReason !== undefined) updatePayload.rejectionReason = dataToUpdate.rejectionReason;
    if (dataToUpdate.priorityScore !== undefined) updatePayload.priorityScore = dataToUpdate.priorityScore?.toString();
    if (dataToUpdate.strategicTheme !== undefined) updatePayload.strategicTheme = dataToUpdate.strategicTheme;
    if (dataToUpdate.searchVolume !== undefined) updatePayload.searchVolume = dataToUpdate.searchVolume;
    if (dataToUpdate.keywordDifficulty !== undefined) updatePayload.keywordDifficulty = dataToUpdate.keywordDifficulty;

    updatePayload.updatedAt = new Date();

    // Check if there are actual changes beyond just updatedAt
    if (Object.keys(updatePayload).length <= 1 && !updatePayload.topicTitle) { // Only updatedAt or no actual changes
        const currentTopic = await db.query.proposedTopics.findFirst({where: eq(proposedTopics.id, topicId)});
        if (!currentTopic) return NextResponse.json({ error: "Proposed topic not found" }, { status: 404 });
        return NextResponse.json({ success: true, topic: currentTopic, message: "No effective changes provided." });
    }

    const updatedTopic = await db.update(proposedTopics)
      .set(updatePayload)
      .where(eq(proposedTopics.id, topicId))
      .returning();

    if (updatedTopic.length === 0) {
      return NextResponse.json({ error: "Proposed topic not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, topic: updatedTopic[0] });

  } catch (error: any) {
    console.error(`Failed to update proposed topic ${topicId}:`, error);
    if (error.message?.includes('unique_topic_title_lower_idx')) {
      return NextResponse.json({ error: 'Updated topic title conflicts with an existing one (case-insensitive).' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update proposed topic', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const topicId = parseInt(params.id);

  if (isNaN(topicId)) {
    return NextResponse.json({ error: "Invalid Topic ID in path" }, { status: 400 });
  }

  try {
    // Optional: Instead of deleting, you might want to change status to 'archived' or 'deleted'
    // For now, let's do a hard delete.
    const deletedTopic = await db.delete(proposedTopics)
      .where(eq(proposedTopics.id, topicId))
      .returning();

    if (deletedTopic.length === 0) {
      return NextResponse.json({ error: "Proposed topic not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `Topic ID ${topicId} deleted successfully.`, deletedTopic: deletedTopic[0] });

  } catch (error: any) {
    console.error(`Failed to delete proposed topic ${topicId}:`, error);
    // Handle potential FK constraint errors if this topic is referenced elsewhere and not set to NULL on delete
    return NextResponse.json({ error: 'Failed to delete proposed topic', details: error.message }, { status: 500 });
  }
}

// GET handler for retrieving a single topic by ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const topicId = parseInt(params.id);

  if (isNaN(topicId)) {
    return NextResponse.json({ error: "Invalid Topic ID in path" }, { status: 400 });
  }

  try {
    const topic = await db.query.proposedTopics.findFirst({
      where: eq(proposedTopics.id, topicId),
      with: {
        product: { columns: { title: true, handle: true, productType: true } },
        pipelineTask: { columns: { id: true, status: true, task_type: true, title: true } },
        blogPost: { columns: { id: true, title: true, slug: true, status: true } }
      }
    });

    if (!topic) {
      return NextResponse.json({ error: "Proposed topic not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, topic });

  } catch (error: any) {
    console.error(`Failed to fetch proposed topic ${topicId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch proposed topic', details: error.message }, { status: 500 });
  }
} 