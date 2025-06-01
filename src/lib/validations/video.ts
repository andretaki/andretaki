import { z } from 'zod';

// Schema for the output from the LLM in VideoStrategyAgent
export const VideoStrategyLLMOutputSchema = z.object({
    title: z.string().max(100, "Title too long").describe("Catchy, persona-infused video title."),
    description: z.string().max(500, "Description too long").describe("SEO-friendly video description."),
    keywords: z.array(z.string()).min(3).max(10).describe("Relevant keywords for the video."),
    segmentPlan: z.array(z.object({
        segment_type: z.string().describe("Type of segment, e.g., 'RAG_PainPoint_Hook', 'ProductBenefit_Demo'"),
        estimated_duration_seconds: z.number().int().positive().describe("Estimated duration in seconds."),
        key_info_points: z.array(z.string()).min(1).max(5).describe("Core information for this segment."),
        visual_angle: z.string().describe("Creative visual idea for the segment."),
        narration_angle: z.string().describe("Tone/direction for the script of the segment."),
        rag_insights_used: z.string().optional().describe("Brief note if a RAG insight directly informed this segment."),
    })).min(2).max(7).describe("Plan for 2-7 video segments."),
    suggested_ad_keywords: z.array(z.string()).optional().describe("Keywords suitable for Google Ads targeting."),
    suggested_target_audience_descriptors: z.array(z.string()).optional().describe("Descriptors for Google Ads audience."),
});
export type VideoStrategyLLMOutput = z.infer<typeof VideoStrategyLLMOutputSchema>;

// Schema for the output of VideoSegmentScriptingAgent (the LLM call part)
export const VideoSegmentScriptingLLMOutputSchema = z.object({
    narration_script: z.string().describe("Concise, engaging script matching persona and segment duration."),
    visual_concept_description: z.string().describe("Detailed visual idea for the segment."),
    visual_generation_prompts: z.array(z.string()).min(1).max(3).describe("2-3 specific prompts for AI image/video models."),
    text_overlay_content: z.array(z.string()).min(0).max(4).describe("2-4 short text overlays."),
});
export type VideoSegmentScriptingLLMOutput = z.infer<typeof VideoSegmentScriptingLLMOutputSchema>;

// Schema for API input to /api/generate/video-strategy
export const GenerateVideoStrategyInputSchema = z.object({
    productId: z.number().int().positive(),
    platformAndGoal: z.string().min(3),
    personaId: z.number().int().positive(),
    optionalBlogId: z.number().int().positive().optional(),
    keyCustomThemes: z.array(z.string()).optional(),
});

// Schema for API input to /api/generate/video-segment-script
export const GenerateVideoSegmentScriptInputSchema = z.object({
    videoSegmentId: z.number().int().positive(),
});

// Zod schema for VideoPersona (if needed for validation, though mostly for DB)
export const VideoPersonaZodSchema = z.object({
    id: z.number().int().positive(),
    name: z.string(),
    description: z.string(),
    style_prompt_modifier: z.string().optional().nullable(),
    humor_style: z.string().optional().nullable(),
    visual_theme_keywords: z.array(z.string()).optional().nullable(),
    voice_characteristics: z.record(z.string(), z.any()).optional().nullable(), // JSONB
    music_style_keywords: z.array(z.string()).optional().nullable(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});
export type VideoPersonaInput = z.infer<VideoPersonaZodSchema>; 