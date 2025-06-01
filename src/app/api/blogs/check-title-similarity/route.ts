import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { blogPosts, proposedTopics } from '../../../../lib/db/schema';
import { generateGeminiEmbedding, findSimilarTopicsWithPgVector, EMBEDDING_DIMENSIONS } from '../../../../lib/ai/embedding-client';
import { TaskType } from '@google/generative-ai';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const SIMILARITY_THRESHOLD_EDITOR = 0.85; // Slightly lower threshold for editor warnings

const CheckTitleSchema = z.object({
    title: z.string().min(3).max(250),
    excludeBlogId: z.number().int().optional(),
    excludeProposedTopicId: z.number().int().optional(),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const validation = CheckTitleSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ success: false, error: "Invalid input", details: validation.error.format() }, { status: 400 });
        }
        const { title, excludeBlogId, excludeProposedTopicId } = validation.data;

        if (!title.trim()) {
            return NextResponse.json({ success: true, similarProposedTopics: [], similarBlogPosts: [] }); // No title, no check
        }

        const embedding = await generateGeminiEmbedding(title, TaskType.SEMANTIC_SIMILARITY);

        // Check similar proposed topics
        const similarProposedTopics = await findSimilarTopicsWithPgVector(
            db, 
            embedding, 
            SIMILARITY_THRESHOLD_EDITOR, 
            3,
            excludeProposedTopicId
        );
        
        // Check similar blog posts
        let blogQuery = sql`
            SELECT id, title, status, 1 - (title_embedding <=> ${`[${embedding.join(',')}]`}::vector(${sql.raw(EMBEDDING_DIMENSIONS.toString())})) AS similarity
            FROM marketing.blog_posts
            WHERE title_embedding IS NOT NULL 
              AND 1 - (title_embedding <=> ${`[${embedding.join(',')}]`}::vector(${sql.raw(EMBEDDING_DIMENSIONS.toString())})) > ${SIMILARITY_THRESHOLD_EDITOR}
        `;
        if (excludeBlogId !== undefined) {
            blogQuery.append(sql` AND id != ${excludeBlogId}`);
        }
        blogQuery.append(sql` ORDER BY similarity DESC LIMIT 3;`);
        
        const similarBlogPostsResult = await db.execute(blogQuery);
        const similarBlogPosts = similarBlogPostsResult.rows as Array<{id: number, title: string, status: string, similarity: number}>;

        return NextResponse.json({ 
            success: true, 
            similarProposedTopics, 
            similarBlogPosts 
        });

    } catch (error: any) {
        console.error('Error checking title similarity:', error);
        return NextResponse.json({ 
            success: false, 
            error: 'Failed to check title similarity', 
            details: error.message 
        }, { status: 500 });
    }
} 