import { z } from 'zod';

export interface AgentResult<T> {
    success: boolean;
    data: T;
    error?: string;
}

export abstract class BaseAgent {
    protected async executeWithRetry<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
        let lastError: Error | undefined;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error as Error;
                console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error);
                if (attempt < maxRetries) {
                    // Exponential backoff
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
            }
        }
        throw lastError || new Error('All retry attempts failed');
    }

    protected async callLLM(prompt: string): Promise<string> {
        // This is a placeholder - implement with your actual LLM client
        throw new Error('LLM client not implemented');
    }

    protected validateLLMResponse<T>(response: string, schema: z.ZodType<T>): T {
        try {
            const parsed = JSON.parse(response);
            return schema.parse(parsed);
        } catch (error) {
            console.error('Failed to validate LLM response:', error);
            console.error('Raw response:', response);
            throw new Error('Invalid LLM response format');
        }
    }
} 