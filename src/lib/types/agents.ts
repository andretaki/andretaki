export interface AgentResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  duration: number;
}

export type AgentModel = 'openai' | 'gemini';

export interface AgentConfig {
  temperature: number;
  maxTokens: number;
  model: AgentModel;
  retries: number;
} 