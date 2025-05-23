import { proxyActivities, sleep, defineWorkflow } from '@temporalio/workflow';
import type { ContentGenerationActivities } from './activities';

const activities = proxyActivities<ContentGenerationActivities>({
  startToCloseTimeout: '30 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumAttempts: 5,
  },
});

export const ContentGenerationWorkflow = defineWorkflow(async function* (productId: string) {
  // Parallel discovery of applications
  const applications = await activities.discoverApplications(productId);
  
  // Fan-out pattern for content generation
  const contentPromises = applications.map(async (app) => {
    const outline = await activities.generateBlogOutline(productId, app.id);
    const [blog, safetyContent] = await Promise.all([
      activities.writeBlogPost(outline),
      activities.generateSafetyContent(productId, app),
    ]);
    
    // Video generation with circuit breaker
    try {
      const videoScript = await activities.generateVideoScript(blog.id);
      await activities.queueVideoGeneration(videoScript);
    } catch (error) {
      // Non-critical failure, continue workflow
      await activities.logVideoGenerationFailure(blog.id, error);
    }
    
    return { blog, safetyContent };
  });
  
  const results = await Promise.all(contentPromises);
  
  // Schedule marketing campaigns
  await activities.scheduleMarketingCampaigns(results);
  
  return results;
}); 