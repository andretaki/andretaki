import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { contentPipeline, productApplications, shopifySyncProducts } from '../../../../lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

interface TaskStat {
  task_type: string;
  status: string;
  count: number;
}

interface EnrichmentResult {
  totalProducts: number;
  enrichedProducts: number;
}

export async function GET() {
  try {
    // Get task counts by type and status
    const taskStats = await db
      .select({
        task_type: contentPipeline.task_type,
        status: contentPipeline.status,
        count: sql<number>`count(*)`
      })
      .from(contentPipeline)
      .groupBy(contentPipeline.task_type, contentPipeline.status)
      .orderBy(contentPipeline.task_type);

    // Get recent tasks
    const recentTasks = await db.query.contentPipeline.findMany({
      orderBy: [desc(contentPipeline.updated_at)],
      limit: 10
    });

    // Get product enrichment status
    const enrichmentStats = await db
      .select({
        totalProducts: sql<number>`count(*)`,
        enrichedProducts: sql<number>`count(CASE WHEN pa.product_id IS NOT NULL THEN 1 END)`
      })
      .from(shopifySyncProducts)
      .leftJoin(productApplications, eq(shopifySyncProducts.id, productApplications.productId))
      .then((result: EnrichmentResult[]) => result[0]);

    // Get pipeline health metrics
    const healthMetrics = {
      totalTasks: taskStats.reduce((sum: number, stat: TaskStat) => sum + stat.count, 0),
      pendingTasks: taskStats.filter((s: TaskStat) => s.status === 'pending').reduce((sum: number, stat: TaskStat) => sum + stat.count, 0),
      failedTasks: taskStats.filter((s: TaskStat) => s.status === 'failed').reduce((sum: number, stat: TaskStat) => sum + stat.count, 0),
      completedTasks: taskStats.filter((s: TaskStat) => s.status === 'completed').reduce((sum: number, stat: TaskStat) => sum + stat.count, 0),
      inProgressTasks: taskStats.filter((s: TaskStat) => s.status === 'in_progress').reduce((sum: number, stat: TaskStat) => sum + stat.count, 0)
    };

    // Structure task stats for easier consumption
    const tasksByType = taskStats.reduce((acc: Record<string, Record<string, number>>, stat: TaskStat) => {
      if (!acc[stat.task_type]) {
        acc[stat.task_type] = {};
      }
      acc[stat.task_type][stat.status] = stat.count;
      return acc;
    }, {} as Record<string, Record<string, number>>);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      pipeline: {
        health: healthMetrics,
        tasksByType,
        enrichment: {
          totalProducts: enrichmentStats.totalProducts,
          enrichedProducts: enrichmentStats.enrichedProducts,
          enrichmentRate: enrichmentStats.totalProducts > 0 
            ? Math.round((enrichmentStats.enrichedProducts / enrichmentStats.totalProducts) * 100) 
            : 0
        }
      },
      recentActivity: recentTasks.map(task => ({
        id: task.id,
        type: task.task_type,
        status: task.status,
        title: task.title,
        createdAt: task.created_at,
        updatedAt: task.updated_at
      }))
    });

  } catch (error) {
    console.error('Error fetching pipeline status:', error);
    return NextResponse.json({
      success: false,
      message: 'Error fetching pipeline status',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 