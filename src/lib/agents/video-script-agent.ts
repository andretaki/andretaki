import { BaseAgent } from './base-agent';
import { AgentResult } from '../../types/agents';
import { Product } from '../db/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { agentConfigurations } from '../db/schema';

export interface VideoScript {
  title: string;
  description: string;
  script: string;
  timestamps: { [key: string]: number };
  keywords: string[];
  visualCues: {
    timestamp: number;
    type: 'molecular' | 'reaction' | 'real-world' | 'safety' | 'text-overlay';
    description: string;
    aiPrompt: string;
  }[];
  voiceInstructions: {
    tone: 'professional' | 'enthusiastic' | 'cautious';
    pace: 'slow' | 'medium' | 'fast';
    emphasis: string[];
  };
  brandingElements: {
    logo: { timestamp: number; position: string }[];
    colors: string[];
    watermark: boolean;
  };
}

const VIDEO_TEMPLATES = {
  'product-introduction': {
    duration: 60,
    sections: [
      { time: "0-5s", content: "hook", visual: "molecular-structure" },
      { time: "5-15s", content: "problem", visual: "real-world-application" },
      { time: "15-45s", content: "solution", visual: "process-animation" },
      { time: "45-60s", content: "cta", visual: "product-showcase" }
    ]
  },
  'safety-protocol': {
    duration: 45,
    sections: [
      { time: "0-3s", content: "warning", visual: "safety-icons" },
      { time: "3-25s", content: "procedures", visual: "step-by-step" },
      { time: "25-45s", content: "emergency", visual: "emergency-kit" }
    ]
  },
  'how-it-works': {
    duration: 30,
    sections: [
      { time: "0-5s", content: "hook", visual: "chemical-reaction" },
      { time: "5-15s", content: "science", visual: "molecular-animation" },
      { time: "15-25s", content: "application", visual: "real-world-use" },
      { time: "25-30s", content: "cta", visual: "product-highlight" }
    ]
  },
  'lab-demonstration': {
    duration: 90,
    sections: [
      { time: "0-10s", content: "intro", visual: "lab-environment" },
      { time: "10-30s", content: "equipment", visual: "lab-equipment" },
      { time: "30-60s", content: "procedure", visual: "step-by-step-lab" },
      { time: "60-80s", content: "results", visual: "results-visualization" },
      { time: "80-90s", content: "conclusion", visual: "key-findings" }
    ]
  },
  'industry-application': {
    duration: 75,
    sections: [
      { time: "0-10s", content: "industry-overview", visual: "industry-landscape" },
      { time: "10-30s", content: "challenge", visual: "industry-problem" },
      { time: "30-50s", content: "solution", visual: "product-application" },
      { time: "50-65s", content: "benefits", visual: "benefits-animation" },
      { time: "65-75s", content: "case-study", visual: "success-story" }
    ]
  },
  'comparison-analysis': {
    duration: 60,
    sections: [
      { time: "0-10s", content: "context", visual: "comparison-setup" },
      { time: "10-25s", content: "product-a", visual: "product-a-features" },
      { time: "25-40s", content: "product-b", visual: "product-b-features" },
      { time: "40-50s", content: "analysis", visual: "comparison-matrix" },
      { time: "50-60s", content: "recommendation", visual: "final-choice" }
    ]
  }
};

const VISUAL_STYLES = {
  'scientific': {
    colorScheme: ['#2C3E50', '#3498DB', '#E74C3C', '#2ECC71'],
    typography: {
      font: 'Roboto Mono',
      headingSize: 'large',
      textSize: 'medium'
    },
    animations: {
      molecular: 'smooth-rotation',
      transitions: 'fade-scientific',
      effects: 'particle-system'
    }
  },
  'modern': {
    colorScheme: ['#1A1A1A', '#4A90E2', '#50E3C2', '#F5A623'],
    typography: {
      font: 'Inter',
      headingSize: 'medium',
      textSize: 'small'
    },
    animations: {
      molecular: 'quick-transition',
      transitions: 'slide-modern',
      effects: 'minimal-particles'
    }
  },
  'educational': {
    colorScheme: ['#34495E', '#9B59B6', '#F1C40F', '#1ABC9C'],
    typography: {
      font: 'Open Sans',
      headingSize: 'large',
      textSize: 'large'
    },
    animations: {
      molecular: 'step-by-step',
      transitions: 'fade-educational',
      effects: 'highlight-focus'
    }
  }
};

const MOLECULAR_VISUALIZATIONS = {
  '3d-rotation': {
    type: 'molecular',
    style: 'smooth-rotation',
    camera: {
      position: [0, 0, 5],
      rotation: [0, 0, 0]
    },
    lighting: {
      ambient: 0.5,
      directional: 0.8
    }
  },
  'reaction-flow': {
    type: 'reaction',
    style: 'particle-flow',
    camera: {
      position: [0, 2, 3],
      rotation: [-30, 0, 0]
    },
    lighting: {
      ambient: 0.7,
      directional: 0.5
    }
  },
  'safety-demo': {
    type: 'safety',
    style: 'step-by-step',
    camera: {
      position: [0, 1, 4],
      rotation: [0, 0, 0]
    },
    lighting: {
      ambient: 0.8,
      directional: 0.6
    }
  }
};

export class VideoScriptAgent extends BaseAgent {
  async execute(
    product: Product,
    blogContent: string,
    options: {
      platform: string;
      duration: number;
      style: string;
      voiceType: string;
      includeSubtitles: boolean;
      template?: keyof typeof VIDEO_TEMPLATES;
      visualStyle?: keyof typeof VISUAL_STYLES;
      molecularVisualization?: keyof typeof MOLECULAR_VISUALIZATIONS;
    }
  ): Promise<AgentResult<VideoScript>> {
    return this.executeWithRetry(async () => {
      // 1. Fetch Agent Configuration
      const agentConfig = await db.query.agentConfigurations.findFirst({
        where: eq(agentConfigurations.agent_type, 'video_script')
      });
      if (!agentConfig) throw new Error("Video script agent configuration not found.");

      // 2. Build the prompt by replacing placeholders in the base prompt
      const prompt = agentConfig.base_prompt
        .replace('{{PRODUCT_TITLE}}', product.title)
        .replace('{{PRODUCT_FORMULA}}', product.chemicalFormula || 'N/A')
        .replace('{{PRODUCT_CAS}}', product.casNumber || 'N/A')
        .replace('{{PRODUCT_PROPERTIES}}', JSON.stringify(product.properties || {}))
        .replace('{{BLOG_CONTENT}}', blogContent)
        .replace('{{PLATFORM}}', options.platform)
        .replace('{{DURATION}}', options.duration.toString())
        .replace('{{STYLE}}', options.style)
        .replace('{{VOICE_TYPE}}', options.voiceType)
        .replace('{{INCLUDE_SUBTITLES}}', options.includeSubtitles.toString())
        .replace('{{TEMPLATE}}', options.template ? JSON.stringify(VIDEO_TEMPLATES[options.template]) : 'null')
        .replace('{{VISUAL_STYLE}}', options.visualStyle ? JSON.stringify(VISUAL_STYLES[options.visualStyle]) : 'null')
        .replace('{{MOLECULAR_VISUALIZATION}}', options.molecularVisualization ? JSON.stringify(MOLECULAR_VISUALIZATIONS[options.molecularVisualization]) : 'null');

      // 3. Call the LLM
      const result = await this.geminiPro.generateContent(prompt);
      const response = await result.response;
      const content = response.text();

      if (!content) {
        throw new Error('No content generated');
      }

      const script = this.parseScript(content);
      await this.logActivity(
        'video_script',
        'product',
        product.id,
        'generate_script',
        { productId: product.id, options, script },
        true,
        0
      );

      return script;
    }, 'Generate video script');
  }

  private parseScript(content: string): VideoScript {
    try {
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to parse video script:', error);
      throw new Error('Invalid video script format');
    }
  }

  async generatePlatformSpecificScript(
    product: Product,
    platform: 'youtube' | 'tiktok' | 'instagram',
    baseScript: VideoScript
  ): Promise<AgentResult<VideoScript>> {
    return this.executeWithRetry(async () => {
      const prompt = this.buildPlatformSpecificPrompt(product, platform, baseScript);
      const result = await this.geminiPro.generateContent(prompt);
      const response = await result.response;
      const content = response.text();

      if (!content) {
        throw new Error('No content generated');
      }

      const script = this.parseScript(content);
      await this.logActivity(
        'platform_specific_script',
        'product',
        product.id,
        'generate_platform_script',
        { productId: product.id, platform, script },
        true,
        0
      );

      return script;
    }, 'Generate platform-specific script');
  }

  private buildPlatformSpecificPrompt(
    product: Product,
    platform: 'youtube' | 'tiktok' | 'instagram',
    baseScript: VideoScript
  ): string {
    const platformConfig = {
      youtube: {
        duration: 60,
        focus: 'Education + Authority',
        hook: '3-second chemical reaction',
        cta: 'Learn more on our website'
      },
      tiktok: {
        duration: 30,
        focus: 'Entertainment + Discovery',
        hook: 'POV: You\'re a chemist explaining...',
        cta: 'Follow for more chemistry'
      },
      instagram: {
        duration: 30,
        focus: 'Aesthetic + Professional',
        hook: 'Beautiful molecular animations',
        cta: 'Shop professional grade'
      }
    };

    const config = platformConfig[platform];

    return `
      Adapt this video script for ${platform}:
      
      Base Script:
      ${JSON.stringify(baseScript, null, 2)}
      
      Platform Requirements:
      Duration: ${config.duration} seconds
      Focus: ${config.focus}
      Hook: ${config.hook}
      CTA: ${config.cta}
      
      Requirements:
      1. Optimize content length for ${platform}
      2. Adjust tone and style for platform audience
      3. Enhance visual elements for platform format
      4. Update CTAs and engagement elements
      5. Maintain chemical accuracy while being platform-appropriate
      
      Format the response as a JSON object with all required fields.
      Ensure the script is optimized for ${platform} while maintaining the core message.
    `;
  }
} 