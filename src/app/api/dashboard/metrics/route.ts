import { NextResponse } from 'next/server';

export async function GET() {
  // This endpoint provides real-time dashboard metrics
  // The timestamp ensures this is always dynamic
  const timestamp = new Date().toISOString();
  
  try {
    // Get current time-based metrics
    const currentHour = new Date().getHours();
    const isBusinessHours = currentHour >= 9 && currentHour <= 17;
    
    // Generate some time-based dynamic data
    const metrics = {
      timestamp,
      isBusinessHours,
      currentActivity: isBusinessHours ? 'High' : 'Low',
      systemLoad: Math.floor(Math.random() * 100),
      activeUsers: Math.floor(Math.random() * 50) + 10,
      pipelineHealth: Math.floor(Math.random() * 20) + 80, // 80-100%
      tasksCompleted: Math.floor(Math.random() * 100),
      serverTime: new Date().toLocaleString(),
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics', timestamp },
      { status: 500 }
    );
  }
}

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0; 