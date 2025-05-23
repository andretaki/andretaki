import { Context } from '@temporalio/activity';
import { z } from 'zod';
import { openai } from '../../lib/ai/client';
import { ChemicalApplicationSchema } from './schemas';

export interface ContentGenerationActivities {
  discoverApplications(productId: string): Promise<z.infer<typeof ChemicalApplicationSchema>[]>;
  generateBlogOutline(productId: string, applicationId: string): Promise<string>;
  writeBlogPost(outline: string): Promise<{ id: string; content: string }>;
  generateSafetyContent(productId: string, application: z.infer<typeof ChemicalApplicationSchema>): Promise<string>;
  generateVideoScript(blogId: string): Promise<string>;
  queueVideoGeneration(script: string): Promise<void>;
  logVideoGenerationFailure(blogId: string, error: Error): Promise<void>;
  scheduleMarketingCampaigns(results: Array<{ blog: { id: string }; safetyContent: string }>): Promise<void>;
}

export class ContentGenerationActivitiesImpl implements ContentGenerationActivities {
  async discoverApplications(productId: string) {
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4-turbo-2024-04-09",
      messages: [
        {
          role: "system",
          content: "You are a chemical industry expert. Analyze products and suggest applications."
        },
        {
          role: "user",
          content: `Analyze product with ID: ${productId}`
        }
      ],
      response_format: { type: "json_object", schema: ChemicalApplicationSchema },
    });
    
    return completion.choices[0].message.parsed;
  }

  async generateBlogOutline(productId: string, applicationId: string) {
    // Implementation for blog outline generation
    return "Blog outline content";
  }

  async writeBlogPost(outline: string) {
    // Implementation for blog post writing
    return { id: "blog-123", content: "Blog content" };
  }

  async generateSafetyContent(productId: string, application: z.infer<typeof ChemicalApplicationSchema>) {
    // Implementation for safety content generation
    return "Safety content";
  }

  async generateVideoScript(blogId: string) {
    // Implementation for video script generation
    return "Video script content";
  }

  async queueVideoGeneration(script: string) {
    // Implementation for video generation queueing
  }

  async logVideoGenerationFailure(blogId: string, error: Error) {
    // Implementation for logging video generation failures
    console.error(`Video generation failed for blog ${blogId}:`, error);
  }

  async scheduleMarketingCampaigns(results: Array<{ blog: { id: string }; safetyContent: string }>) {
    // Implementation for scheduling marketing campaigns
  }
} 