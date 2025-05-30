import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { contentPipeline } from '../../../../lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Fetch recent blog ideas from the content pipeline
    const topics = await db.query.contentPipeline.findMany({
      where: eq(contentPipeline.task_type, 'blog_idea'),
      orderBy: [desc(contentPipeline.created_at)],
      limit: 20 // Get the most recent 20 topics
    });

    // Transform to simple topic strings
    const topicTitles = topics.map(topic => topic.title);

    return NextResponse.json({
      success: true,
      topics: topicTitles,
      count: topics.length
    });

  } catch (error) {
    console.error('Error fetching topics:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch topics', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 