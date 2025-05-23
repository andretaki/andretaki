import { AgentConfig, AgentResult } from '../../types/agents';
import { OpenAI } from 'openai';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected openai: OpenAI;
  protected gemini: GoogleGenerativeAI;
  protected geminiPro: GenerativeModel;
  protected geminiFlash: GenerativeModel;

  constructor(config: AgentConfig) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    this.geminiPro = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
    this.geminiFlash = this.gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<AgentResult<T>> {
    const startTime = Date.now();
    let attempts = 0;

    while (attempts < this.config.retries) {
      try {
        const result = await operation();
        return {
          success: true,
          data: result,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        attempts++;
        if (attempts === this.config.retries) {
          return {
            success: false,
            error: `Failed after ${attempts} attempts: ${error}`,
            duration: Date.now() - startTime,
          };
        }
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    }

    return {
      success: false,
      error: `Failed after ${this.config.retries} attempts`,
      duration: Date.now() - startTime,
    };
  }

  protected async logActivity(
    type: string,
    entity: string,
    entityId: number | null,
    action: string,
    details: Record<string, any>,
    success: boolean,
    duration: number
  ) {
    // TODO: Implement activity logging
    console.log(`[${type}] ${action} for ${entity}${entityId ? ` #${entityId}` : ''} - ${success ? 'Success' : 'Failed'} (${duration}ms)`);
  }

  abstract execute(...args: any[]): Promise<AgentResult>;
} 