import { BaseAgent } from './base-agent';
import { AgentResult } from '../../types/agents';
import { Product, VideoPersona, BlogPost, VideoSegment, productApplications } from '../db/schema';
import { VideoSegmentScriptingLLMOutputSchema, VideoSegmentScriptingLLMOutput as LLMOutputType } from '../validations/video';

export type ScriptingOutput = LLMOutputType; // The agent output is the same as the LLM output for this agent

export class VideoSegmentScriptingAgent extends BaseAgent {
    async execute(
        segment: VideoSegment,
        product: Product,
        persona: VideoPersona,
        videoMasterTitle: string,
        blogPost?: BlogPost, // Optional blog post context
        application?: typeof productApplications.$inferSelect // Optional application context
    ): Promise<AgentResult<ScriptingOutput>> {
        return this.executeWithRetry(async () => {
            // 1. Context Gathering (already mostly passed in, but can augment)
            let blogContextSnippet = "";
            if (blogPost && segment.segment_type.toLowerCase().includes('blog')) { // Example: only include if relevant to segment type
                blogContextSnippet = `Relevant Blog Post ("${blogPost.title}") Excerpt: ${blogPost.content?.substring(0, 150)}...`;
            }
            let applicationContextSnippet = "";
            if (application && segment.segment_type.toLowerCase().includes('application')) {
                applicationContextSnippet = `Relevant Application: ${application.application} (${application.industry}). Use Case: ${application.useCase?.substring(0,150)}...`;
            }

            // 2. LLM Prompt Construction
            const systemPrompt = `You are a creative scriptwriter and visual director, embodying the persona: "${persona.name}" (${persona.description}). Your style is ${persona.style_prompt_modifier || 'engaging and clear'} with ${persona.humor_style || 'appropriate humor'}. Your output must be a JSON object adhering to the VideoSegmentScriptingLLMOutputSchema.`;
            
            const userPrompt = `
                Video Master Title: "${videoMasterTitle}"
                Product: ${product.title} (CAS: ${(product.metafields as any)?.cas_number || 'N/A'})
                Persona: ${persona.name}
                - Visual Keywords: ${persona.visual_theme_keywords?.join(', ') || 'standard corporate clean'}
                - Voice Characteristics: ${JSON.stringify(persona.voice_characteristics) || 'clear, professional'}

                Segment Details to Script:
                - Type: ${segment.segment_type}
                - Estimated Duration: ${segment.duration_seconds} seconds
                - Key Info Points (from strategy): ${(segment.key_info_points as string[])?.join('; ') || 'N/A'}
                - Initial Visual Angle (from strategy): ${segment.visual_angle || 'N/A'}
                - Initial Narration Angle (from strategy): ${segment.narration_angle || 'N/A'}

                Additional Context (if available):
                ${blogContextSnippet}
                ${applicationContextSnippet}
                - Product Description: ${product.description?.substring(0,200) || 'N/A'}

                Your Task: Generate a JSON object with the following fields for this segment:
                1. "narration_script": Concise, engaging script matching persona and segment duration.
                2. "visual_concept_description": Detailed visual idea evolving from the initial visual_angle, incorporating persona's visual keywords.
                3. "visual_generation_prompts": 2-3 specific prompts for AI image/video models (e.g., DALL-E, RunwayML) based on the visual concept.
                4. "text_overlay_content": 2-4 short text overlays to enhance the message or add persona flavor.

                Make sure the script is timed well for ${segment.duration_seconds} seconds.
                The visual prompts should be creative and leverage the persona's visual style.
            `;

            // 3. LLM Call & Validation
            const llmResponse = await this.geminiPro.generateContent({
                contents: [{ role: 'user', parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: this.config.temperature, // Use agent's base config or specific one
                    maxOutputTokens: this.config.maxTokens,
                }
            });
            
            const rawJsonText = llmResponse.response.text();
            if (!rawJsonText) {
                throw new Error("LLM returned empty response for segment scripting.");
            }

            let parsedOutput: ScriptingOutput;
            try {
                parsedOutput = VideoSegmentScriptingLLMOutputSchema.parse(JSON.parse(rawJsonText));
            } catch (e) {
                console.error("Failed to parse or validate LLM output for VideoSegmentScripting:", e);
                console.error("Raw LLM output:", rawJsonText);
                throw new Error(`LLM output validation failed: ${e instanceof Error ? e.message : String(e)}`);
            }

            await this.logActivity('video_segment_scripting', 'video_segment', segment.id, 'generate_script_details', {
                video_id: segment.video_id,
                segment_type: segment.segment_type,
            }, true, 0 /* TODO: Token count */);

            return parsedOutput;

        }, 'video_segment_scripting'); // Add context parameter
    }
} 