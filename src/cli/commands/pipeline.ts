import { Command } from 'commander';
import { db } from '../../lib/db';
import { contentPipeline, productApplications, shopifySyncProducts } from '../../lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

const pipelineCommand = new Command('pipeline');

pipelineCommand
  .description('Manage and monitor the content pipeline')
  .addCommand(
    new Command('status')
      .description('Show pipeline status and statistics')
      .action(async () => {
        try {
          console.log('📊 Pipeline Status Report\n');

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
            limit: 5
          });

          // Calculate health metrics
          const healthMetrics = {
            totalTasks: taskStats.reduce((sum, stat) => sum + stat.count, 0),
            pendingTasks: taskStats.filter(s => s.status === 'pending').reduce((sum, stat) => sum + stat.count, 0),
            failedTasks: taskStats.filter(s => s.status === 'failed').reduce((sum, stat) => sum + stat.count, 0),
            completedTasks: taskStats.filter(s => s.status === 'completed').reduce((sum, stat) => sum + stat.count, 0),
            inProgressTasks: taskStats.filter(s => s.status === 'in_progress').reduce((sum, stat) => sum + stat.count, 0)
          };

          // Display health metrics
          console.log('🏥 Health Metrics:');
          console.log(`  Total Tasks: ${healthMetrics.totalTasks}`);
          console.log(`  Pending: ${healthMetrics.pendingTasks}`);
          console.log(`  In Progress: ${healthMetrics.inProgressTasks}`);
          console.log(`  Completed: ${healthMetrics.completedTasks}`);
          console.log(`  Failed: ${healthMetrics.failedTasks}`);
          console.log();

          // Display task breakdown by type
          const tasksByType = taskStats.reduce((acc, stat) => {
            if (!acc[stat.task_type]) {
              acc[stat.task_type] = {};
            }
            acc[stat.task_type][stat.status] = stat.count;
            return acc;
          }, {} as Record<string, Record<string, number>>);

          console.log('📋 Tasks by Type:');
          Object.entries(tasksByType).forEach(([type, statuses]) => {
            console.log(`  ${type}:`);
            Object.entries(statuses).forEach(([status, count]) => {
              const emoji = status === 'completed' ? '✅' : status === 'failed' ? '❌' : status === 'in_progress' ? '⏳' : '⏸️';
              console.log(`    ${emoji} ${status}: ${count}`);
            });
          });
          console.log();

          // Display recent activity
          console.log('📝 Recent Activity:');
          recentTasks.forEach(task => {
            const statusEmoji = task.status === 'completed' ? '✅' : task.status === 'failed' ? '❌' : task.status === 'in_progress' ? '⏳' : '⏸️';
            const timeAgo = Math.round((Date.now() - new Date(task.updated_at).getTime()) / (1000 * 60));
            console.log(`  ${statusEmoji} ${task.task_type} - ${task.title?.substring(0, 50)}... (${timeAgo}m ago)`);
          });

        } catch (error) {
          console.error('❌ Error fetching pipeline status:', error);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('trigger')
      .description('Manually trigger pipeline processing')
      .action(async () => {
        try {
          console.log('🚀 Triggering pipeline processing...\n');

          // This would call the pipeline processing logic
          // For now, we'll just show what would happen
          console.log('Pipeline stages that would run:');
          console.log('1. 🔍 Product Enrichment');
          console.log('2. 💡 Blog Idea Generation');
          console.log('3. 📋 Outline Creation');
          console.log('4. ✍️  Section Content Generation');
          console.log('5. 📚 Draft Assembly');
          
          console.log('\n✅ Manual trigger would execute these stages.');
          console.log('💡 Tip: Use the web API /api/pipeline/trigger for actual execution');
          
        } catch (error) {
          console.error('❌ Error triggering pipeline:', error);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('show-tasks')
      .description('Show recent pipeline tasks')
      .option('-l, --limit <number>', 'Number of tasks to show', '10')
      .option('-t, --type <type>', 'Filter by task type')
      .option('-s, --status <status>', 'Filter by status')
      .action(async (options) => {
        try {
          console.log('📋 Pipeline Tasks\n');

          const limit = parseInt(options.limit);
          let whereConditions = [];

          if (options.type) {
            whereConditions.push(eq(contentPipeline.task_type, options.type));
          }

          if (options.status) {
            whereConditions.push(eq(contentPipeline.status, options.status));
          }

          const tasks = await db.query.contentPipeline.findMany({
            where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
            orderBy: [desc(contentPipeline.updated_at)],
            limit
          });

          if (tasks.length === 0) {
            console.log('No tasks found matching the criteria.');
            return;
          }

          console.log(`Showing ${tasks.length} tasks:\n`);

          tasks.forEach((task, index) => {
            const statusEmoji = task.status === 'completed' ? '✅' : task.status === 'failed' ? '❌' : task.status === 'in_progress' ? '⏳' : '⏸️';
            const timeAgo = Math.round((Date.now() - new Date(task.updated_at).getTime()) / (1000 * 60));
            
            console.log(`${index + 1}. ${statusEmoji} [${task.task_type}] ${task.title}`);
            console.log(`   Status: ${task.status} | Updated: ${timeAgo}m ago`);
            if (task.summary) {
              console.log(`   Summary: ${task.summary.substring(0, 100)}...`);
            }
            console.log();
          });

        } catch (error) {
          console.error('❌ Error fetching tasks:', error);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('enrichment')
      .description('Check product enrichment status')
      .action(async () => {
        try {
          console.log('🧪 Product Enrichment Status\n');

          // Get total products
          const totalProducts = await db
            .select({ count: sql<number>`count(*)` })
            .from(shopifySyncProducts)
            .then(result => result[0].count);

          // Get enriched products
          const enrichedProducts = await db
            .select({ count: sql<number>`count(DISTINCT ${productApplications.productId})` })
            .from(productApplications)
            .then(result => result[0].count);

          const enrichmentRate = totalProducts > 0 ? Math.round((enrichedProducts / totalProducts) * 100) : 0;

          console.log(`📊 Enrichment Statistics:`);
          console.log(`  Total Products: ${totalProducts}`);
          console.log(`  Enriched Products: ${enrichedProducts}`);
          console.log(`  Enrichment Rate: ${enrichmentRate}%`);
          console.log();

          // Show products needing enrichment
          const productsNeedingEnrichment = await db.query.shopifySyncProducts.findMany({
            where: sql`NOT EXISTS (
              SELECT 1 FROM ${productApplications} 
              WHERE ${productApplications.productId} = ${shopifySyncProducts.id}
            )`,
            orderBy: [desc(shopifySyncProducts.updated_at)],
            limit: 5
          });

          if (productsNeedingEnrichment.length > 0) {
            console.log('🔍 Products Needing Enrichment (showing first 5):');
            productsNeedingEnrichment.forEach((product, index) => {
              console.log(`  ${index + 1}. ${product.title} (ID: ${product.id})`);
            });
          } else {
            console.log('✅ All products are enriched!');
          }

        } catch (error) {
          console.error('❌ Error checking enrichment status:', error);
          process.exit(1);
        }
      })
  );

export { pipelineCommand }; 