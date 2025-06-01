import { BaseAgent } from './base-agent';
import { AgentResult } from '../../types/agents';
import { Product, VideoPersona, blogPosts, productApplications, shopifySyncProducts } from '../db/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { ragApiClient, RagQueryFilters } from '../rag/client';
import { VideoStrategyLLMOutputSchema, VideoStrategyLLMOutput as LLMOutputType } from '../validations/video';

export interface VideoStrategyOutput {
    videoId: number;
    title: string;
    description: string;
    keywords: string[];
    segmentPlanDbData: Array<Omit<typeof videoSegments.$inferInsert, 'id' | 'created_at' | 'updated_at'>>; // For direct insertion
    suggestedAdKeywords?: string[];
    suggestedTargetAudienceDescriptors?: string[];
}

export class VideoStrategyAgent extends BaseAgent {
    async execute(
        videoId: number,
        product: Product,
        platform_and_goal_str: string,
        persona: VideoPersona,
        optionalBlogId?: number,
        keyCustomThemes?: string[]
    ): Promise<AgentResult<VideoStrategyOutput>> {
        return this.executeWithRetry(async () => {
            // 1. Parse platform_and_goal
            const [platform, goal, style] = platform_and_goal_str.split('_');

            // 2. Context Gathering
            let blogPostSummary = "";
            if (optionalBlogId) {
                const blogPostData = await db.query.blogPosts.findFirst({
                    where: eq(blogPosts.id, optionalBlogId),
                    columns: { title: true, excerpt: true, content: true }
                });
                if (blogPostData) {
                    blogPostSummary = `Blog Post Context ("${blogPostData.title}"): ${blogPostData.excerpt || blogPostData.content?.substring(0, 200)}...`;
                }
            }

            const relatedApplications = await db.query.productApplications.findMany({
                where: eq(productApplications.productId, product.id),
                orderBy: (fields, { desc }) => [desc(fields.marketPotential), desc(fields.creativity)], // Example ordering
                limit: 2,
            });
            const applicationSummaries = relatedApplications.map(app => `- ${app.application} (${app.industry}): ${app.useCase?.substring(0, 100)}...`).join('\n') || "No specific applications highlighted.";

            // 3. RAG Integration
            const ragQueries: { theme: string; query: string; filters?: RagQueryFilters, purpose: string }[] = [
                {
                    theme: "Customer Pain Points/Questions",
                    query: `What are common customer pain points, questions, or frustrations related to ${product.title} or its typical applications that could be addressed in a video?`,
                    purpose: "To create a compelling hook for the video by addressing real user concerns.",
                },
                {
                    theme: "Strongest USPs/Benefits",
                    query: `What are the strongest unique selling propositions or benefits of ${product.title} according to customer reviews or feedback?`,
                    purpose: "To highlight key value propositions in the video.",
                },
                {
                    theme: "Common Use Cases/Success Stories",
                    query: `Describe common use cases or success stories for ${product.title}'s applications.`,
                    filters: { source_type: ['case_study', 'product_page_example', 'customer_testimonial_doc'] },
                    purpose: "To showcase practical applications and build credibility.",
                },
            ];

            if (goal?.toLowerCase().includes("safety")) {
                ragQueries.push({
                    theme: "Safety Information",
                    query: `What are crucial safety tips or warnings associated with ${product.title}?`,
                    filters: { source_type: ['safety_data_sheet_pdf', 'coa_pdf', 'safety_manual_doc'] },
                    purpose: "To incorporate essential safety information if the goal is safety-focused.",
                });
            }

            let ragInsightsForPrompt = "No specific RAG insights were available for this video. Focus on general product knowledge and creative persona application.\n";
            const collectedRagInsights: { theme: string; summary: string; purpose: string }[] = [];

            if (process.env.RAG_API_URL) { // Ensure RAG API is configured
                for (const rq of ragQueries) {
                    try {
                        console.log(`[VideoStrategyAgent] RAG Query - Theme: ${rq.theme}`);
                        const searchResults = await ragApiClient.search(rq.query, 3, rq.filters);
                        if (searchResults.results.length > 0) {
                            const contentToSummarize = searchResults.results.map(r => r.content).join("\n\n");
                            // Max summary length of 100 words to keep it concise for the prompt
                            const summary = await ragApiClient.summarizeContent(contentToSummarize, 100, `for a video about ${product.title} focusing on ${rq.theme}`);
                            if (summary) {
                                collectedRagInsights.push({ ...rq, summary });
                            }
                        }
                    } catch (error) {
                        console.warn(`[VideoStrategyAgent] RAG query for theme "${rq.theme}" failed:`, error);
                    }
                }
                if (collectedRagInsights.length > 0) {
                    ragInsightsForPrompt = "Key Insights from RAG System:\n" +
                        collectedRagInsights.map(insight => `* Theme: "${insight.theme}" (Purpose for video: ${insight.purpose})\n  Insight: ${insight.summary}`).join("\n") + "\n";
                }
            }
            
            // 4. LLM Prompt Construction
            const systemPrompt = `You are an expert B2B chemical industry video ad/content strategist. You embody the persona: ${persona.name} (${persona.description}). Your style is ${persona.style_prompt_modifier || 'professional and informative'} with a touch of ${persona.humor_style || 'neutral humor'}. Your task is to generate a video strategy as a JSON object strictly adhering to the VideoStrategyLLMOutputSchema.`;
            
            const userPrompt = `
                Product: ${product.title} (CAS: ${product.casNumber || 'N/A'})
                Platform & Goal: ${platform_and_goal_str} (Parsed: Platform=${platform}, Goal=${goal}, Style=${style || 'default'})
                Persona: ${persona.name}
                - Visual Keywords: ${persona.visual_theme_keywords?.join(', ') || 'standard corporate clean'}
                - Voice Characteristics: ${JSON.stringify(persona.voice_characteristics) || 'clear, professional'}
                - Music Style: ${persona.music_style_keywords?.join(', ') || 'neutral background music'}

                Context:
                - Product Info: ${product.description?.substring(0, 200) || 'High-quality chemical product.'}...
                - Related Applications: ${applicationSummaries}
                ${blogPostSummary ? `- Blog Summary: ${blogPostSummary}` : ''}
                ${keyCustomThemes ? `- Custom Themes: ${keyCustomThemes.join(', ')}` : ''}
                
                ${ragInsightsForPrompt}

                Instructions:
                - Generate a video strategy.
                - The "segmentPlan" must contain 3-7 concise segments.
                - Each segment should have "segment_type", "estimated_duration_seconds", "key_info_points" (1-3 bullets), "visual_angle", and "narration_angle".
                - Note if "rag_insights_used" directly informed a segment.
                - Durations must be appropriate for the platform/goal (e.g., TikTok: short segments; YouTube Deep Dive: longer).
                - Ensure the output is a single JSON object matching the VideoStrategyLLMOutputSchema.
            `;

            // 5. LLM Call & Validation
            const llmResponse = await this.geminiPro.generateContent({
                contents: [{ role: 'user', parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: this.config.temperature,
                    maxOutputTokens: this.config.maxTokens,
                }
            });
            
            const rawJsonText = llmResponse.response.text();
            if (!rawJsonText) {
                throw new Error("LLM returned empty response for video strategy.");
            }

            let parsedOutput: LLMOutputType;
            try {
                parsedOutput = VideoStrategyLLMOutputSchema.parse(JSON.parse(rawJsonText));
            } catch (e) {
                console.error("Failed to parse or validate LLM output for VideoStrategy:", e);
                console.error("Raw LLM output:", rawJsonText);
                throw new Error(`LLM output validation failed: ${e instanceof Error ? e.message : String(e)}`);
            }
            
            // 6. Output
            const segmentPlanDbData = parsedOutput.segmentPlan.map((seg, index) => ({
                videoId: videoId,
                segment_order: index + 1,
                segment_type: seg.segment_type,
                duration_seconds: seg.estimated_duration_seconds,
                key_info_points: seg.key_info_points, // Store as JSONB in DB
                visual_angle: seg.visual_angle, // Store as text
                narration_angle: seg.narration_angle, // Store as text
                narration_script: seg.narration_angle, // Initialize script from narration_angle
                visual_concept_description: seg.visual_angle, // Initialize visual concept from visual_angle
                source_product_id: product.id,
                rag_insights_summary: seg.rag_insights_used || null,
                status: 'pending' as const, // Ensure type safety for status
            }));

            const agentOutput: VideoStrategyOutput = {
                videoId,
                title: parsedOutput.title,
                description: parsedOutput.description,
                keywords: parsedOutput.keywords,
                segmentPlanDbData: segmentPlanDbData as VideoStrategyOutput['segmentPlanDbData'], // Cast after mapping
                suggestedAdKeywords: parsedOutput.suggested_ad_keywords,
                suggestedTargetAudienceDescriptors: parsedOutput.suggested_target_audience_descriptors,
            };
            
            await this.logActivity('video_strategy', 'video', videoId, 'generate_strategy', {
                productId: product.id,
                platform_and_goal: platform_and_goal_str,
                personaId: persona.id,
                segments_created: segmentPlanDbData.length
            }, true, 0 /* TODO: Get token count from Gemini if available */);

            return agentOutput;
        });
    }
} 