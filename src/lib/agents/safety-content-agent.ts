import { BaseAgent } from './base-agent';
import { AgentResult } from '../../types/agents';
import { Product, ProductApplications } from '../db/schema';

interface SafetyArticle {
  title: string;
  slug: string;
  metaDescription: string;
  content: string;
  safetyLevel: 'basic' | 'intermediate' | 'advanced';
  targetAudience: string[];
  relatedProducts: string[];
  safetyProtocols: {
    title: string;
    steps: string[];
    precautions: string[];
    emergencyProcedures: string[];
  }[];
  regulatoryCompliance: {
    standards: string[];
    requirements: string[];
    documentation: string[];
  };
  seriesInfo?: {
    seriesTitle: string;
    partNumber: number;
    totalParts: number;
    nextArticle?: string;
    previousArticle?: string;
  };
}

export class SafetyContentAgent extends BaseAgent {
  async execute(
    product: Product,
    application?: ProductApplications
  ): Promise<AgentResult<SafetyArticle>> {
    return this.executeWithRetry(async () => {
      const prompt = this.buildPrompt(product, application);
      const result = await this.geminiPro.generateContent(prompt);
      const response = await result.response;
      const content = response.text();

      if (!content) {
        throw new Error('No content generated');
      }

      const article = this.parseArticle(content);
      await this.logActivity(
        'safety_content',
        'product',
        product.id,
        'generate_safety_article',
        { productId: product.id, applicationId: application?.id, article },
        true,
        0
      );

      return article;
    }, 'Generate safety article');
  }

  private buildPrompt(product: Product, application?: ProductApplications): string {
    return `
      Create a comprehensive safety article for the following chemical product:
      
      Product: ${product.title}
      Chemical Formula: ${product.chemicalFormula}
      CAS Number: ${product.casNumber}
      Properties: ${JSON.stringify(product.properties)}
      ${application ? `Application: ${application.application}\nIndustry: ${application.industry}` : ''}
      
      Requirements:
      1. Create a detailed safety article that includes:
         - Clear safety protocols and procedures
         - Handling instructions
         - Storage requirements
         - Emergency procedures
         - First aid measures
         - PPE requirements
         - Disposal guidelines
      
      2. Include specific sections for:
         - Basic safety (for general users)
         - Intermediate safety (for trained personnel)
         - Advanced safety (for chemical professionals)
      
      3. Address regulatory compliance:
         - Relevant safety standards
         - Required documentation
         - Industry-specific regulations
      
      4. Format the content for a blog post with:
         - SEO-optimized title and meta description
         - Clear headings and subheadings
         - Bullet points for procedures
         - Tables for safety data
         - Warning boxes for critical information
         - Internal links to related products
         - External links to regulatory resources
      
      5. If this is part of a series:
         - Create a logical progression of safety topics
         - Link to previous and next articles
         - Maintain consistent formatting
      
      6. Include Shopify-specific elements:
         - Product safety data sheet links
         - Related product recommendations
         - Safety equipment and PPE product links
         - Emergency response kit recommendations
      
      Format the response as a JSON object with all the required fields.
      Ensure all safety information is accurate and up-to-date with current regulations.
    `;
  }

  private parseArticle(content: string): SafetyArticle {
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse safety article: ${error}`);
    }
  }

  async generateSafetySeries(
    products: Product[],
    theme: string
  ): Promise<AgentResult<SafetyArticle[]>> {
    return this.executeWithRetry(async () => {
      const seriesPrompt = this.buildSeriesPrompt(products, theme);
      const result = await this.geminiPro.generateContent(seriesPrompt);
      const response = await result.response;
      const content = response.text();

      if (!content) {
        throw new Error('No content generated');
      }

      const series = this.parseSeries(content);
      await this.logActivity(
        'safety_series',
        'products',
        null,
        'generate_safety_series',
        { productIds: products.map(p => p.id), theme, series },
        true,
        0
      );

      return series;
    }, 'Generate safety series');
  }

  private buildSeriesPrompt(products: Product[], theme: string): string {
    return `
      Create a series of safety articles for the following chemical products, focusing on the theme: ${theme}
      
      Products:
      ${products.map(p => `
        - ${p.title}
        - Chemical Formula: ${p.chemicalFormula}
        - CAS Number: ${p.casNumber}
        - Properties: ${JSON.stringify(p.properties)}
      `).join('\n')}
      
      Requirements:
      1. Create a logical progression of safety topics that:
         - Builds knowledge from basic to advanced
         - Covers all products in the series
         - Maintains consistent formatting
         - Links articles together
      
      2. Each article should include:
         - Part number and total parts
         - Links to previous and next articles
         - Series overview
         - Product-specific safety information
         - Common safety protocols
         - Emergency procedures
      
      3. Include Shopify integration:
         - Product safety data sheets
         - Related safety equipment
         - Emergency response kits
         - Training materials
      
      Format the response as a JSON array of safety articles.
      Ensure the series provides comprehensive safety coverage for all products.
    `;
  }

  private parseSeries(content: string): SafetyArticle[] {
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse safety series: ${error}`);
    }
  }
} 