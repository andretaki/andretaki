import { type BlogOutline as AgentBlogOutlineType } from '../lib/agents/blog-outline-agent'; // Adjust path if necessary

export interface AgentConfig {
  model: 'openai' | 'gemini';
  temperature: number;
  maxTokens: number;
  retries: number;
}

export interface AgentResult<T = any> { // Default T to any
  success: boolean;
  data?: T;
  error?: string;
  duration: number;
  context?: string; // Added from base-agent improvements
}

export interface ContentGenerationOptions {
  productIds?: number[];
  contentType?: 'applications' | 'blog' | 'video' | 'safety' | 'safety_series' | 'all';
  batchSize?: number;
  onComplete?: (productId: number, result: { success: boolean; duration: number }) => void;
  onError?: (productId: number, error: string) => void;
  blogOptions?: { // Added blog specific options
    targetAudience?: string;
    persona?: string;
    tone?: AgentBlogOutlineType['tone'];
    technicalDepth?: AgentBlogOutlineType['technicalDepth'];
    requestedWordCount?: number;
  };
}

export interface VideoGenerationOptions {
  platform: string;
  duration: number;
  style: string;
  voiceType: string;
  includeSubtitles: boolean;
}

export interface SafetyArticle {
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