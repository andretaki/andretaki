import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { videoSegments, videos } from '../../../../../lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';

// Validation schema for the videoId parameter
const GetVideoSegmentsParamsSchema = z.object({
  videoId: z.string().transform((val) => parseInt(val, 10)),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    // Validate the videoId parameter
    const { videoId } = GetVideoSegmentsParamsSchema.parse(params);

    // Check if the video exists
    const video = await db.query.videos.findFirst({
      where: eq(videos.id, videoId),
    });

    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Fetch all segments for the video, ordered by segment_order
    const segments = await db.query.videoSegments.findMany({
      where: eq(videoSegments.video_id, videoId),
      orderBy: [asc(videoSegments.segment_order)],
    });

    return NextResponse.json(segments);
  } catch (error) {
    console.error('Error fetching video segments:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid video ID' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 