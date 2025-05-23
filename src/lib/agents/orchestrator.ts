import { db } from '../db';
import { products, productApplications, blogPosts, videos, contentQueue, type BlogOutline as DbBlogOutlineType, type Product, type ProductApplications } from '../db/schema';
import { ContentGenerationOptions as BaseContentGenerationOptions, AgentResult } from '../../types/agents';
import { ApplicationsAgent } from './applications-agent';
import { BlogOutlineAgent, type BlogOutline as AgentBlogOutlineType } from './blog-outline-agent';
import { BlogWriterAgent } from './blog-writer-agent';
import { VideoScriptAgent } from './video-script-agent';
import { SafetyContentAgent } from './safety-content-agent';

const DEFAULT_CONFIG = {
  model: 'openai' as const,
  temperature: 0.5,
  maxTokens: 3000,
  retries: 3,
};

export interface ContentGenerationOptions extends BaseContentGenerationOptions {
  blogOptions?: {
    targetAudience?: string;
    persona?: string;
    tone?: AgentBlogOutlineType['tone'];
    technicalDepth?: AgentBlogOutlineType['technicalDepth'];
    requestedWordCount?: number;
  };
}

export async function generateContentForProducts(options?: ContentGenerationOptions) {
  const applicationsAgent = new ApplicationsAgent(DEFAULT_CONFIG);
  const blogOutlineAgent = new BlogOutlineAgent({...DEFAULT_CONFIG, temperature: 0.3 });
  const blogWriterAgent = new BlogWriterAgent({...DEFAULT_CONFIG, temperature: 0.6 });
  const videoScriptAgent = new VideoScriptAgent(DEFAULT_CONFIG);
  const safetyContentAgent = new SafetyContentAgent(DEFAULT_CONFIG);

  const productIdsToProcess = options?.productIds || (await db.select({ id: products.id }).from(products)).map(p => p.id);
  const batchSize = options?.batchSize || Number(process.env.CONTENT_GENERATION_BATCH_SIZE) || 5;

  for (let i = 0; i < productIdsToProcess.length; i += batchSize) {
    const batch = productIdsToProcess.slice(i, i + batchSize);
    await Promise.all(batch.map(async (productId) => {
      const startTime = Date.now();
      let currentProduct: Product | null = null;
      try {
        const productResult = await db.query.products.findFirst({
          where: (products, { eq }) => eq(products.id, productId),
        });
        currentProduct = productResult || null;

        if (!currentProduct) {
          console.error(`Product not found: ${productId}. Skipping.`);
          options?.onError?.(productId, `Product not found: ${productId}`);
          return;
        }
        
        console.log(`Processing product: ${currentProduct.title} (ID: ${productId})`);

        if (options?.contentType === 'applications' || options?.contentType === 'all') {
          console.log(`Discovering applications for ${currentProduct.title}...`);
          const applicationsResult = await applicationsAgent.execute(currentProduct);
          if (applicationsResult.success && applicationsResult.data) {
            await db.insert(productApplications).values(
              applicationsResult.data.map(app => ({
                productId: currentProduct!.id,
                application: app.application,
                industry: app.industry,
                useCase: app.useCase,
                technicalDetails: JSON.stringify({}),
                creativity: app.creativity,
                marketPotential: app.marketPotential,
              }))
            ).onConflictDoNothing();
            console.log(`Discovered ${applicationsResult.data.length} applications for ${currentProduct.title}.`);
          } else {
            console.warn(`Failed to discover applications for ${currentProduct.title}: ${applicationsResult.error}`);
          }
        }

        if (options?.contentType === 'blog' || options?.contentType === 'all') {
          const application = await db.query.productApplications.findFirst({
            where: (apps, { eq }) => eq(apps.productId, currentProduct!.id),
            orderBy: (apps, { desc }) => [desc(apps.marketPotential), desc(apps.creativity)],
          });

          if (application) {
            console.log(`Generating blog outline for ${currentProduct.title} - Application: ${application.application}...`);
            const outlineResult = await blogOutlineAgent.execute(currentProduct, application, options?.blogOptions);
            
            if (outlineResult.success && outlineResult.data) {
              const richOutline = outlineResult.data;
              console.log(`Generated outline: "${richOutline.title}". Writing blog post...`);
              
              const contentResult = await blogWriterAgent.execute(currentProduct, richOutline);
              if (contentResult.success && contentResult.data) {
                const blogContent = contentResult.data;
                await db.insert(blogPosts).values({
                  productId: currentProduct.id,
                  applicationId: application.id,
                  title: richOutline.title,
                  slug: richOutline.title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').substring(0, 250),
                  outline: richOutline as unknown as DbBlogOutlineType,
                  content: blogContent,
                  status: 'draft',
                  metaDescription: richOutline.seoElements.metaDescription,
                  keywords: [richOutline.seoElements.primaryKeyword],
                  wordCount: blogContent.split(/\s+/).length,
                  metadata: { 
                    targetAudience: options?.blogOptions?.targetAudience,
                    writerPersona: options?.blogOptions?.persona,
                    blogTone: richOutline.tone,
                    technicalDepthLevel: richOutline.technicalDepth,
                  }
                });
                console.log(`Successfully generated blog post: "${richOutline.title}"`);
              } else {
                console.error(`Failed to write blog post for "${richOutline.title}": ${contentResult.error}`);
                options?.onError?.(productId, `Blog writing failed: ${contentResult.error}`);
              }
            } else {
              console.error(`Failed to generate blog outline for ${currentProduct.title} - ${application.application}: ${outlineResult.error}`);
              options?.onError?.(productId, `Blog outline generation failed: ${outlineResult.error}`);
            }
          } else {
            console.warn(`No suitable application found for ${currentProduct.title} to generate blog post.`);
            options?.onError?.(productId, "No application found for blog post generation.");
          }
        }

        if (options?.contentType === 'safety' || options?.contentType === 'all') {
          const safetyResult = await safetyContentAgent.execute(currentProduct);
          if (safetyResult.success && safetyResult.data) {
            await db.insert(blogPosts).values({
              productId: currentProduct.id,
              title: safetyResult.data.title,
              slug: safetyResult.data.slug,
              content: safetyResult.data.content,
              metaDescription: safetyResult.data.metaDescription,
              type: 'safety',
              status: 'draft',
              metadata: {
                safetyLevel: safetyResult.data.safetyLevel,
                targetAudience: safetyResult.data.targetAudience,
                safetyProtocols: safetyResult.data.safetyProtocols,
                regulatoryCompliance: safetyResult.data.regulatoryCompliance,
                seriesInfo: safetyResult.data.seriesInfo,
              },
            });
          }
        }

        if (options?.contentType === 'video' || options?.contentType === 'all') {
          const blogPost = await db.query.blogPosts.findFirst({
            where: (posts, { eq }) => eq(posts.productId, currentProduct!.id),
          });

          if (blogPost) {
            const scriptResult = await videoScriptAgent.execute(currentProduct, blogPost.content, {
              platform: 'youtube',
              duration: Number(process.env.DEFAULT_VIDEO_DURATION) || 60,
              style: 'educational',
              voiceType: 'professional',
              includeSubtitles: true,
            });

            if (scriptResult.success && scriptResult.data) {
              await db.insert(videos).values({
                blogPostId: blogPost.id,
                platform: 'youtube',
                title: scriptResult.data.title,
                description: scriptResult.data.description,
                script: scriptResult.data.script,
                status: 'queued',
              });
            }
          }
        }

        options?.onComplete?.(productId, { success: true, duration: Date.now() - startTime });
      } catch (error) {
        console.error(`Unhandled error processing product ${productId} (${currentProduct?.title || 'N/A'}):`, error);
        options?.onError?.(productId, error instanceof Error ? error.message : String(error));
      }
    }));
  }
}

export async function generateSafetySeries(
  productIds: number[],
  theme: string,
  options?: ContentGenerationOptions
) {
  const safetyContentAgent = new SafetyContentAgent(DEFAULT_CONFIG);

  try {
    const products = await db.query.products.findMany({
      where: (products, { inArray }) => inArray(products.id, productIds),
    });

    if (products.length === 0) {
      throw new Error('No products found');
    }

    const seriesResult = await safetyContentAgent.generateSafetySeries(products, theme);
    if (seriesResult.success && seriesResult.data) {
      for (const article of seriesResult.data) {
        await db.insert(blogPosts).values({
          productId: products[0].id,
          title: article.title,
          slug: article.slug,
          content: article.content,
          metaDescription: article.metaDescription,
          type: 'safety_series',
          status: 'draft',
          metadata: {
            safetyLevel: article.safetyLevel,
            targetAudience: article.targetAudience,
            safetyProtocols: article.safetyProtocols,
            regulatoryCompliance: article.regulatoryCompliance,
            seriesInfo: article.seriesInfo,
          },
        });
      }
    }

    options?.onComplete?.(productIds[0], { success: true, duration: 0 });
  } catch (error) {
    console.error('Error generating safety series:', error);
    options?.onError?.(productIds[0], error instanceof Error ? error.message : String(error));
  }
} 