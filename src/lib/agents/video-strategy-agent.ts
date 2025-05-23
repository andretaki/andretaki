import { BaseAgent, AgentResult } from '../ai/base-agent';
import { eq } from 'drizzle-orm';
import { Product, VideoPersona, videoSegments, videos, blogPosts, productApplications } from '../db/schema';
import { db } from '../db';
import { ragApiClient, RagQueryFilters, RagChunk } from '../rag/client';
import { z } from 'zod';

// Define the Zod schema for the expected output of this agent's LLM call
const VideoStrategyLLMOutputSchema = z.object({
    title: z.string().max(100, "Title too long").describe("Catchy, persona-infused video title."),
    description: z.string().max(500, "Description too long").describe("SEO-friendly video description."),
    keywords: z.array(z.string()).min(3).max(10).describe("Relevant keywords for the video."),
    segmentPlan: z.array(z.object({
        segment_type: z.string().describe("Type of segment, e.g., 'rag_insight_hook', 'problem_from_emails'"),
        estimated_duration_seconds: z.number().int().positive().describe("Estimated duration in seconds."),
        key_info_points: z.array(z.string()).min(1).describe("Core information for this segment."),
        visual_angle: z.string().describe("Visual idea for the segment."),
        narration_angle: z.string().describe("Narration direction for the segment."),
        rag_insights_used: z.string().optional().describe("Brief note on RAG insights used."),
    })).min(2).max(7).describe("Plan for 3-7 video segments."),
    suggested_ad_keywords: z.array(z.string()).optional().describe("Keywords suitable for Google Ads targeting."),
    suggested_target_audience_descriptors: z.array(z.string()).optional().describe("Descriptors for Google Ads audience."),
});
type VideoStrategyLLMOutput = z.infer<typeof VideoStrategyLLMOutputSchema>;

export interface VideoStrategyOutput {
    videoId: number;
    title: string;
    description: string;
    keywords: string[];
    segmentPlanDbData: Array<{
        id?: number;
        videoId: number;
        segment_order: number;
        segment_type: string;
        duration_seconds: number;
        narration_script: string;
        visual_concept_description: string;
        source_product_id?: number | null;
        rag_insights_summary?: string | null;
        status: 'pending' | string;
    }>;
    suggestedAdKeywords?: string[];
    suggestedTargetAudienceDescriptors?: string[];
}

export class VideoStrategyAgent extends BaseAgent {
    async execute(
        videoId: number,
        product: Product,
        platform_and_goal: string,
        persona: VideoPersona,
        optionalBlogId?: number,
        keyCustomThemes?: string[]
    ): Promise<AgentResult<VideoStrategyOutput>> {
        return this.executeWithRetry(async () => {
            const [platform, campaignGoal, styleModifier] = platform_and_goal.split('_');

            // 1. Fetch structured data from Marketing DB
            let blogContentSummary = "";
            if (optionalBlogId) {
                const blogPost = await db.query.blogPosts.findFirst({ where: eq(blogPosts.id, optionalBlogId) });
                blogContentSummary = blogPost ? `Context from blog post "${blogPost.title}": ${blogPost.excerpt || blogPost.content?.substring(0, 300)}...` : "";
            }
            const applications = await db.query.productApplications.findMany({ 
                where: eq(productApplications.productId, product.id), 
                limit: 2 
            });
            const appSummaries = applications.map(app => `- ${app.application} in ${app.industry}: ${app.useCase?.substring(0,100)}...`).join('\n') || "Key applications include research and industrial uses.";

            // 2. Define RAG Queries based on the "DOPE" video goal & Google Ads context
            const ragQueries: { theme: string, query: string, filters?: RagQueryFilters, purpose_for_video: string }[] = [
                {
                    theme: "Real Customer Voice & Pain Points (for Ad Hooks/Resonance)",
                    query: `What are the exact phrases, questions, frustrations, or desired outcomes customers express regarding "${product.title}" (CAS: ${product.casNumber}) or its applications? Extract direct quotes or summarize key sentiments.`,
                    filters: { 
                        source_type: ['email_summary_anonymized', 'amazon_product_review', 'google_business_review', 'sales_call_note', 'support_ticket_summary'] 
                    },
                    purpose_for_video: "To craft ad hooks and body copy that resonate deeply by using authentic customer language and addressing known pain points directly."
                },
                {
                    theme: "Product 'Aha!' Moments & Strongest Benefits (for Ad Value Proposition)",
                    query: `What are the most compelling benefits, 'aha!' moments, or unexpected positive outcomes customers report after using "${product.title}"? What makes them choose it over alternatives?`,
                    filters: { 
                        source_type: ['amazon_product_review', 'google_business_review', 'customer_testimonial_doc', 'positive_feedback_email']
                    },
                    purpose_for_video: "To highlight the most impactful value propositions in the ad, focusing on benefits that generate enthusiasm or solve major problems."
                },
                {
                    theme: "Commercial Context & Purchase Drivers (from QuickBooks/Sales Data for Ad Targeting/Messaging)",
                    query: `What industries or types of businesses frequently purchase "${product.title}"? Are there notes on invoices or customer records in QuickBooks that indicate specific project types or reasons for purchase? Are there common co-purchased items?`,
                    filters: {
                        source_type: ['quickbooks_invoice_note', 'quickbooks_customer_memo', 'sales_crm_note', 'order_analysis_summary']
                    },
                    purpose_for_video: "To understand the commercial context, identify targettable customer segments/industries, and find angles related to business value or common product pairings for ads."
                }
            ];

            // Add COA query if relevant
            if (keyCustomThemes?.includes("guaranteed_purity") || campaignGoal?.includes("quality_focus")) {
                ragQueries.push({
                    theme: "Proof of Quality (from COAs for Ad Credibility)",
                    query: `Extract key purity specifications or notable quality metrics for "${product.title}" (CAS: ${product.casNumber}) from recent Certificates of Analysis (COA).`,
                    filters: { 
                        source_type: ['pdf_coa'] 
                    },
                    purpose_for_video: "To provide concrete proof points for quality claims in ads, building trust and credibility."
                });
            }

            // 3. Execute RAG queries & synthesize insights
            let ragInsightsForPrompt = "No specific RAG insights were pulled for this video. Focus on general product knowledge and creative persona application.\n";
            const collectedRagSummaries: {theme: string, summary: string, purpose: string}[] = [];

            if (process.env.RAG_API_URL) {
                const ragQueryPromises = ragQueries.map(async (rq) => {
                    try {
                        console.log(`[VideoStrategyAgent] RAG Query for Ad Video - Theme: ${rq.theme}`);
                        const ragResult = await ragApiClient.search(rq.query, 3, rq.filters);
                        if (ragResult.results.length > 0) {
                            const chunksContent = ragResult.results.map(c => `[Source: ${c.source_document_name || 'Internal Note'}] ${c.content}`).join("\n---\n");
                            const summary = await ragApiClient.summarizeContent(chunksContent, 75, `video ad strategy for ${product.title} regarding ${rq.theme}`);
                            if (summary) {
                                collectedRagSummaries.push({ theme: rq.theme, summary, purpose: rq.purpose_for_video });
                            }
                        }
                    } catch (ragError) {
                        console.warn(`[VideoStrategyAgent] RAG query failed for theme "${rq.theme}":`, ragError);
                    }
                });
                await Promise.all(ragQueryPromises);

                if (collectedRagSummaries.length > 0) {
                    ragInsightsForPrompt = "Key Insights from RAG System (customer voice, reviews, sales/QB notes, COAs, etc.) to weave into the video:\n" +
                                          collectedRagSummaries.map(rs => `* Theme: "${rs.theme}" (Purpose: ${rs.purpose})\n  Insight: ${rs.summary}`).join("\n") + "\n";
                }
            }

            // 4. Build the LLM prompt for video strategy
            const llmSystemPrompt = `You are a ${persona.style_prompt_modifier || 'brilliant and edgy'} video ad strategist. Your specialty is creating "${persona.humor_style || 'highly engaging'}" and "DOPE ass" video concepts for Google Ads in the B2B chemical industry that actually convert. You must use provided RAG insights to make ads authentic and impactful. The output must be a JSON object adhering to VideoStrategyLLMOutputSchema.`;

            const llmUserPrompt = `
                Develop a video ad strategy for a "${platform}" video targeting the "${campaignGoal || 'general_awareness'}" Google Ads campaign goal.
                Product: "${product.title}" (CAS: ${product.casNumber}).
                Ad Persona: "${persona.name}" (Description: ${persona.description}; Voice: ${JSON.stringify(persona.voice_characteristics)}; Music: ${persona.music_style_keywords?.join(', ') || 'energetic'}).

                Core Product Info (from our DB):
                - Description: ${product.description?.substring(0,150) || 'A leading chemical solution.'}
                - Applications: ${appSummaries}
                Custom Themes for this Ad: ${keyCustomThemes?.join(', ') || 'Focus on solving a key customer problem identified in RAG.'}

                ${ragInsightsForPrompt}

                Your Task: Based on ALL the above, generate a JSON object for the video ad strategy.
                Video Ad Specifics:
                - Platform: Google Ads (consider formats like skippable in-stream, non-skippable, bumper, Shorts on YouTube).
                - Length: Tailor segment durations for typical ad lengths on the target Google Ads placement (e.g., 15s, 30s, or modular for responsive video ads).
                - Hook: Must be incredibly strong within the first 3-5 seconds. Use RAG insights for this.
                - Value Proposition: Clearly communicate benefits, informed by RAG (what customers *actually* value).
                - CTA: Strong and clear, aligned with the '${campaignGoal}'.
                - "DOPE" Factor: Inject the "${persona.name}" persona's unique humor and style. Make it memorable and shareable, not boring B2B.
                - Google Ads Best Practices: Keep branding visible, text overlays concise, mobile-first mindset.

                Output JSON fields:
                1. "title": Ad headline variant (short, punchy).
                2. "description": Ad copy variant (concise, benefit-driven).
                3. "keywords": Keywords to associate with this ad creative concept.
                4. "segmentPlan": 2-4 concise segments.
                    - "segment_type": e.g., "RAG_PainPoint_Hook", "ProductDemo_HumorousTwist", "BenefitHighlight_CustomerQuote_RAG", "StrongCTA_PersonaVoice".
                    - "estimated_duration_seconds": (e.g., Hook: 3-5s, Problem/Solution: 7-10s, CTA: 3-5s).
                    - "key_info_points": Very concise. What absolutely *must* be said?
                    - "visual_angle": Dynamic, attention-grabbing, persona-aligned. How can RAG insights be visualized?
                    - "narration_angle": Persona voice, potentially directly using or rephrasing RAG quotes.
                    - "rag_insights_used": Specific RAG theme/insight that fuels this segment.
                5. "suggested_ad_keywords": Keywords from RAG insights and product context for Google Ads targeting.
                6. "suggested_target_audience_descriptors": Audience segments identified from RAG insights.`;

            const llmResponse = await this.callLLM(llmSystemPrompt + "\n\n" + llmUserPrompt);
            const strategyOutput = this.validateLLMResponse(llmResponse, VideoStrategyLLMOutputSchema);

            // 5. Prepare database-ready segment data
            const segmentPlanDbData = strategyOutput.segmentPlan.map((segment: VideoStrategyLLMOutput['segmentPlan'][0], index: number) => ({
                videoId,
                segment_order: index + 1,
                segment_type: segment.segment_type,
                duration_seconds: segment.estimated_duration_seconds,
                narration_script: segment.narration_angle,
                visual_concept_description: segment.visual_angle,
                source_product_id: product.id,
                rag_insights_summary: segment.rag_insights_used,
                status: 'pending'
            }));

            // 6. Return the complete strategy
            return {
                success: true,
                data: {
                    videoId,
                    title: strategyOutput.title,
                    description: strategyOutput.description,
                    keywords: strategyOutput.keywords,
                    segmentPlanDbData,
                    suggestedAdKeywords: strategyOutput.suggested_ad_keywords,
                    suggestedTargetAudienceDescriptors: strategyOutput.suggested_target_audience_descriptors
                }
            };
        });
    }
} 