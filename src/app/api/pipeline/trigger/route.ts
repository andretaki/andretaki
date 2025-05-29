import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Make a request to our cron endpoint
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const cronResponse = await fetch(`${baseUrl}/api/cron/process-pipeline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'dev-secret'}`
      }
    });

    const result = await cronResponse.json();

    if (cronResponse.ok) {
      return NextResponse.json({
        success: true,
        message: 'Pipeline triggered successfully',
        data: result
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Pipeline trigger failed',
        error: result
      }, { status: cronResponse.status });
    }
  } catch (error) {
    console.error('Error triggering pipeline:', error);
    return NextResponse.json({
      success: false,
      message: 'Error triggering pipeline',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Pipeline trigger endpoint - use POST to trigger pipeline processing',
    endpoints: {
      trigger: 'POST /api/pipeline/trigger',
      status: 'GET /api/pipeline/status'
    }
  });
} 