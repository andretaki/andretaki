import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { videos, videoSegments } from '../../../../../lib/db/schema';
import { z } from 'zod';

// Validation schema for request body
const requestSchema = z.object({
    productId: z.number(),
    platformAndGoal: z.string(),
    personaId: z.number(),
    optionalBlogId: z.number().optional(),
    keyCustomThemes: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const validatedData = requestSchema.parse(body);

        // Create video record
        const [video] = await db.insert(videos).values({
            product_id: validatedData.productId,
            blog_post_id: validatedData.optionalBlogId,
            video_persona_id: validatedData.personaId,
            title: 'Pending Strategy Generation', // Will be updated by agent
            description: 'Pending Strategy Generation', // Will be updated by agent
            platform_and_goal: validatedData.platformAndGoal,
            status: 'strategizing',
        }).returning();

        // TODO: Trigger async agent to generate strategy
        // For now, return success with video ID
        return NextResponse.json({
            success: true,
            videoId: video.id,
            title: video.title,
            description: video.description,
            keywords: [],
            segmentsCreated: 0,
        });
    } catch (error) {
        console.error('Error generating video strategy:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { success: false, error: 'Invalid request data', details: error.errors },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, error: 'Failed to generate video strategy' },
            { status: 500 }
        );
    }
} 