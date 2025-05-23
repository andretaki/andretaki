import { BaseAgent } from './base-agent';
import { AgentResult } from '../../types/agents';
import { Product } from '../db/schema';

interface ApplicationDiscovery {
  application: string;
  industry: string;
  useCase: string;
  creativity: number;
  marketPotential: number;
}

export class ApplicationsAgent extends BaseAgent {
  async execute(product: Product): Promise<AgentResult<ApplicationDiscovery[]>> {
    return this.executeWithRetry(async () => {
      const prompt = this.buildPrompt(product);
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in chemical applications and industrial processes. Your task is to discover innovative applications for chemical products.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No content generated');
      }

      const applications = this.parseApplications(content);
      await this.logActivity(
        'application_discovery',
        'product',
        product.id,
        'discover_applications',
        { productId: product.id, applications },
        true,
        response.usage?.total_tokens || 0
      );

      return applications;
    }, 'Discover applications');
  }

  private buildPrompt(product: Product): string {
    return `
      Analyze the following chemical product and suggest innovative applications:
      
      Product: ${product.title}
      Chemical Formula: ${product.chemicalFormula}
      CAS Number: ${product.casNumber}
      Properties: ${JSON.stringify(product.properties)}
      
      For each application, provide:
      1. The specific application
      2. Target industry
      3. Detailed use case
      4. Creativity score (1-10)
      5. Market potential score (1-10)
      
      Format the response as a JSON array of objects with these fields.
    `;
  }

  private parseApplications(content: string): ApplicationDiscovery[] {
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse applications: ${error}`);
    }
  }
} 