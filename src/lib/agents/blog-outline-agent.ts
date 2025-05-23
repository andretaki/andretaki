import { BaseAgent } from './base-agent';
import { AgentResult } from '../../types/agents';
import { Product, ProductApplications, BlogOutline as DbBlogOutline, BlogOutlineZodSchema } from '../db/schema';

// Re-export the BlogOutline type for use in other files
export type BlogOutline = DbBlogOutline;

export class BlogOutlineAgent extends BaseAgent {
  async execute(
    product: Product,
    application: ProductApplications,
    options?: {
      targetAudience?: string;
      persona?: string;
      tone?: BlogOutline['tone'];
      technicalDepth?: BlogOutline['technicalDepth'];
      requestedWordCount?: number;
    }
  ): Promise<AgentResult<BlogOutline>> {
    return this.executeWithRetry(async () => {
      const prompt = this.buildPrompt(product, application, options);
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are an expert content strategist and technical writer specializing in the chemical industry. 
                      Your task is to create highly detailed, engaging, and SEO-optimized blog post outlines. 
                      The outline must strictly conform to the provided BlogOutlineZodSchema.
                      Pay close attention to all field descriptions in the schema.
                      Ensure section points are actionable and provide clear direction for a writer.`
          },
          {
            role: 'user',
            content: `${prompt}\n\nReturn a single JSON object for the outline. The object must strictly follow this Zod schema structure:\n${JSON.stringify(BlogOutlineZodSchema.description || BlogOutlineZodSchema, null, 2)}`
          }
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No content generated for blog outline');
      }

      let outline: BlogOutline;
      try {
        const parsedJson = JSON.parse(content);
        outline = BlogOutlineZodSchema.parse(parsedJson);
      } catch (error) {
        console.error("BlogOutlineAgent: Failed to parse or validate OpenAI response:", error);
        console.error("BlogOutlineAgent: Received content:", content);
        throw new Error(`Failed to process blog outline: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      await this.logActivity(
        'blog_outline',
        'product_application',
        application.id,
        'generate_outline',
        { productId: product.id, applicationId: application.id, title: outline.title, audience: outline.targetAudience },
        true,
        response.usage?.total_tokens || 0
      );

      return outline;
    }, 'Generate blog outline');
  }

  private buildPrompt(
    product: Product, 
    application: ProductApplications,
    options?: {
      targetAudience?: string;
      persona?: string;
      tone?: BlogOutline['tone'];
      technicalDepth?: BlogOutline['technicalDepth'];
      requestedWordCount?: number;
    }
  ): string {
    const wordCount = options?.requestedWordCount || Number(process.env.DEFAULT_BLOG_LENGTH) || 800;
    return `
      Create a comprehensive blog post outline for the chemical product "${product.title}" (CAS: ${product.casNumber || 'N/A'}) 
      focusing on its application: "${application.application}" (Industry: "${application.industry}", Use Case: "${application.useCase}").

      Product Information:
      - Name: ${product.title}
      - Chemical Formula: ${product.chemicalFormula || 'N/A'}
      - Key Properties: ${product.properties ? JSON.stringify(product.properties) : 'Refer to product datasheet'}
      - Current Description: ${product.description || 'N/A'}

      Application Context:
      - Specific Application: ${application.application}
      - Target Industry: ${application.industry}
      - Detailed Use Case: ${application.useCase}
      - Technical Details (if any from app discovery): ${application.technicalDetails || 'N/A'}
      - Market Potential Score (1-10): ${application.marketPotential || 'N/A'}

      Blog Post Requirements & Instructions (Adhere to these when filling the schema):
      - Target Audience: ${options?.targetAudience || 'Chemical engineers and R&D scientists'}
      - Writer Persona: ${options?.persona || 'Experienced Chemical Industry Expert'}
      - Tone: ${options?.tone || 'informative_overview'}
      - Technical Depth: ${options?.technicalDepth || 'intermediate'}
      - Estimated Total Word Count: Approximately ${wordCount} words. Distribute this logically across sections.

      Instructions for BlogOutlineZodSchema fields:
      - title: Make it catchy, benefit-driven, and include the primary keyword if natural.
      - hook: Start with a compelling statistic, question, or problem statement relevant to the target audience and application.
      - sections: 
        - Aim for 3-5 well-defined sections.
        - Section titles should be engaging.
        - 'points' for each section should be detailed sub-topics or questions the writer should answer. Think of them as mini-prompts for the writer.
        - 'keyTakeaways' should summarize the core message of each section.
        - 'estimatedWordCount' for each section should sum up to the total.
      - conclusion: Summarize the main benefits/points and offer a forward-looking statement or final piece of advice.
      - cta: Make it relevant to the product and the content of the blog post.
      - seoElements:
        - 'primaryKeyword': Identify a strong primary keyword related to "${product.title} ${application.application}".
        - 'secondaryKeywords': Provide 3-5 LSI keywords or related search terms.
        - 'metaDescription': Craft a concise and compelling summary for search engines.
        - 'internalLinkSuggestions': Suggest 1-2 highly relevant internal pages (e.g., product page for "${product.title}", a related category page). Use placeholders like "/path/to/page".
        - 'externalLinkSuggestions': Suggest 1-2 authoritative external sources if appropriate (e.g., research papers, industry standards bodies).
      
      The outline should be practical and provide enough guidance for another AI agent to write a high-quality blog post.
      Focus on unique aspects of the product in the given application.
    `;
  }
} 