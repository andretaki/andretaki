import { BaseAgent } from './base-agent';
import { AgentResult } from '../../types/agents';
import { VideoSegment, VideoPersona, Product, BlogPost, ProductApplications } from '../db/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';

interface ScriptingOutput {
    narration_script: string;
    visual_concept_description: string;
    visual_generation_prompts: string[];
    text_overlay_content: string[];
}

export class VideoSegmentScriptingAgent extends BaseAgent {
    async execute(
        segment: VideoSegment,
        product: Product,
        persona: VideoPersona,
        blogPost?: BlogPost,
        application?: ProductApplications
    ): Promise<AgentResult<ScriptingOutput>> {
        return this.executeWithRetry(async () => {
            // Fetch additional context if needed
            const sourceData = {
                blog: blogPost ? {
                    title: blogPost.title,
                    excerpt: blogPost.excerpt,
                    content: blogPost.content?.substring(0, 300)
                } : null,
                application: application ? {
                    name: application.application,
                    industry: application.industry,
                    useCase: application.useCase,
                    technicalDetails: application.technicalDetails
                } : null
            };

            const prompt = `
                Create engaging content for a video segment about "${product.title}" (CAS: ${product.casNumber}).
                
                Segment Details:
                - Type: ${segment.segment_type}
                - Duration: ${segment.duration_seconds} seconds
                - Order: ${segment.segment_order}
                
                Persona Style:
                - Name: ${persona.name}
                - Description: ${persona.description}
                - Style Modifier: ${persona.style_prompt_modifier}
                - Humor Style: ${persona.humor_style}
                - Visual Keywords: ${persona.visual_theme_keywords?.join(', ')}
                - Voice: ${JSON.stringify(persona.voice_characteristics)}
                
                Source Data:
                - Product Description: ${product.description || 'N/A'}
                - Properties: ${JSON.stringify(product.properties) || 'Standard chemical properties'}
                - Safety Info: ${JSON.stringify(product.safetyInfo)?.substring(0,200) || 'Standard safety precautions apply.'}
                ${sourceData.blog ? `- Blog Context: ${sourceData.blog.title} - ${sourceData.blog.excerpt || sourceData.blog.content}` : ''}
                ${sourceData.application ? `- Application Context: ${sourceData.application.name} in ${sourceData.application.industry} - ${sourceData.application.useCase}` : ''}

                Generate a JSON object with:
                1. "narration_script": (string) A concise, engaging script (${segment.duration_seconds} seconds) that matches the persona's style and humor.
                2. "visual_concept_description": (string) A detailed description of the visual concept, incorporating the persona's visual keywords.
                3. "visual_generation_prompts": (array of strings) 2-3 specific prompts for image/video AI models (DALL-E, Midjourney, RunwayML).
                4. "text_overlay_content": (array of strings) 2-4 text overlays to appear during the segment (e.g., key points, jokes, callouts).

                Guidelines:
                - Keep the narration script concise and engaging
                - Ensure visual concepts align with the persona's style
                - Make text overlays impactful but not overwhelming
                - Incorporate humor and style from the persona
                - Focus on the key information for this segment type
            `;

            const llmResponse = await this.openai.chat.completions.create({
                model: "gpt-4-turbo",
                messages: [
                    { role: "system", content: "You are a creative video scripting AI that specializes in creating engaging, persona-driven content." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" },
            });

            const content = llmResponse.choices[0].message.content;
            if (!content) throw new Error("No scripting content generated");

            const parsedScript = JSON.parse(content);

            // Validate the output structure
            if (!parsedScript.narration_script || !parsedScript.visual_concept_description || 
                !Array.isArray(parsedScript.visual_generation_prompts) || !Array.isArray(parsedScript.text_overlay_content)) {
                throw new Error("Invalid scripting output structure");
            }

            const resultData: ScriptingOutput = {
                narration_script: parsedScript.narration_script,
                visual_concept_description: parsedScript.visual_concept_description,
                visual_generation_prompts: parsedScript.visual_generation_prompts,
                text_overlay_content: parsedScript.text_overlay_content
            };

            await this.logActivity(
                'video_segment_scripting',
                'video_segment',
                segment.id,
                'generate_script',
                { segment_type: segment.segment_type },
                true,
                llmResponse.usage?.total_tokens || 0
            );

            return resultData;
        }, 'Generate Segment Script');
    }
} 