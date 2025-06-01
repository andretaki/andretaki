import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { videoSegments } from '../../../../../lib/db/schema';
import { z } from 'zod';
import { eq } from 'drizzle-orm';

// Validation schema for request body
const requestSchema = z.object({
    videoSegmentId: z.number(),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const validatedData = requestSchema.parse(body);

        // Update segment status to scripting_in_progress
        const [segment] = await db.update(videoSegments)
            .set({ status: 'scripting_in_progress' })
            .where(eq(videoSegments.id, validatedData.videoSegmentId))
            .returning();

        if (!segment) {
            return NextResponse.json(
                { success: false, error: 'Video segment not found' },
                { status: 404 }
            );
        }

        // TODO: Trigger async agent to generate script
        // For now, return success with updated segment
        return NextResponse.json({
            success: true,
            updatedSegment: segment,
        });
    } catch (error) {
        console.error('Error generating video segment script:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { success: false, error: 'Invalid request data', details: error.errors },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, error: 'Failed to generate video segment script' },
            { status: 500 }
        );
    }
} 