-- Ensure the marketing schema exists
CREATE SCHEMA IF NOT EXISTS "marketing";

-- Add new columns to existing tables if they don't exist
-- For rag_system.shopify_sync_products
ALTER TABLE "rag_system"."shopify_sync_products"
ADD COLUMN IF NOT EXISTS "cas_number" text,
ADD COLUMN IF NOT EXISTS "chemical_formula" text,
ADD COLUMN IF NOT EXISTS "properties" jsonb,
ADD COLUMN IF NOT EXISTS "safety_info" jsonb;

-- For marketing.blog_posts
ALTER TABLE "marketing"."blog_posts"
ADD COLUMN IF NOT EXISTS "excerpt" text;

-- Create video_personas table
CREATE TABLE IF NOT EXISTS "marketing"."video_personas" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar(255) NOT NULL UNIQUE,
    "description" text NOT NULL,
    "style_prompt_modifier" text,
    "humor_style" varchar(100),
    "visual_theme_keywords" jsonb, -- Store as string[]
    "voice_characteristics" jsonb, -- Store as Record<string, any>
    "music_style_keywords" jsonb, -- Store as string[]
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_video_personas_name" ON "marketing"."video_personas" ("name");

-- Create videos table
CREATE TABLE IF NOT EXISTS "marketing"."videos" (
    "id" serial PRIMARY KEY NOT NULL,
    "product_id" integer REFERENCES "rag_system"."shopify_sync_products"("id") ON DELETE SET NULL,
    "blog_post_id" integer REFERENCES "marketing"."blog_posts"("id") ON DELETE SET NULL,
    "video_persona_id" integer REFERENCES "marketing"."video_personas"("id") ON DELETE SET NULL,
    "title" varchar(255) NOT NULL,
    "description" text,
    "keywords" jsonb, -- Store as string[]
    "platform_and_goal" varchar(255) NOT NULL,
    "status" varchar(50) DEFAULT 'pending_strategy' NOT NULL,
    "error_message" text,
    "suggested_ad_keywords" jsonb, -- Store as string[]
    "suggested_target_audience_descriptors" jsonb, -- Store as string[]
    "final_video_url" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_videos_product_id" ON "marketing"."videos" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_videos_status" ON "marketing"."videos" ("status");
CREATE INDEX IF NOT EXISTS "idx_videos_persona_id" ON "marketing"."videos" ("video_persona_id");

-- Create video_segments table
CREATE TABLE IF NOT EXISTS "marketing"."video_segments" (
    "id" serial PRIMARY KEY NOT NULL,
    "video_id" integer NOT NULL REFERENCES "marketing"."videos"("id") ON DELETE CASCADE,
    "segment_order" integer NOT NULL,
    "segment_type" varchar(100) NOT NULL,
    "duration_seconds" integer NOT NULL,
    "key_info_points" jsonb, -- Store as string[]
    "visual_angle" text,
    "narration_angle" text,
    "narration_script" text,
    "visual_concept_description" text,
    "visual_generation_prompts" jsonb, -- Store as string[]
    "text_overlay_content" jsonb, -- Store as string[]
    "visual_asset_url" text,
    "voiceover_asset_url" text,
    "status" varchar(50) DEFAULT 'pending' NOT NULL,
    "error_message" text,
    "source_product_id" integer REFERENCES "rag_system"."shopify_sync_products"("id") ON DELETE SET NULL,
    "rag_insights_summary" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "unique_video_segment_order_idx" UNIQUE ("video_id", "segment_order")
);
CREATE INDEX IF NOT EXISTS "idx_video_segments_video_id" ON "marketing"."video_segments" ("video_id");
CREATE INDEX IF NOT EXISTS "idx_video_segments_status" ON "marketing"."video_segments" ("status");

-- Seed some initial Video Personas
INSERT INTO "marketing"."video_personas" ("name", "description", "style_prompt_modifier", "humor_style", "visual_theme_keywords", "voice_characteristics", "music_style_keywords") VALUES
('Professor Chem', 'A knowledgeable and slightly eccentric chemistry professor.', 'Act as a passionate and articulate chemistry professor, like a younger, more energetic Bill Nye focusing on industrial chemistry.', 'Witty, Pun-based, Dry', '["chalkboard_diagrams", "vintage_lab_equipment", "clean_graphics", "dynamic_molecule_renders"]', '{"tone": "baritone", "pace": "measured_but_engaging", "accent": "neutral_american_academic"}', '["curious_strings", "light_classical", "educational_background_music"]'),
('Safety Sam', 'A very cautious and by-the-book safety expert.', 'Act as an extremely meticulous and safety-conscious lab supervisor, emphasizing protocols and risk mitigation.', 'Deadpan, Situational (irony of danger)', '["warning_signs", "ppe_closeups", "hazard_symbols_animated", "sterile_environment"]', '{"tone": "calm_assertive", "pace": "deliberate", "accent": "clear_enunciation"}', '["minimalist_alert_sounds", "tense_undercurrent_music", "no_music_for_impact"]'),
('Chad Chemical', 'A high-energy, slightly bro-ey chemical influencer.', 'Act as a super enthusiastic and "stoked" chemical influencer, always excited about the "epic reactions" and "gnarly applications".', 'Exaggerated, Slang-heavy, Self-deprecating', '["fast_cuts", "extreme_closeups_reactions", "bold_text_overlays", "user_generated_content_style"]', '{"tone": "energetic_high_pitch", "pace": "fast", "accent": "california_surfer_dude"}', '["upbeat_electronic", "pop_punk_instrumental", "driving_rock_beats"]')
ON CONFLICT (name) DO NOTHING;

-- Seed agent configurations for video agents
INSERT INTO "marketing"."agent_configurations" (agent_type, llm_model_name, base_prompt, default_parameters, output_parser_type, is_active) VALUES
('video_strategy_agent', 'gemini-1.5-pro-latest', 'You are an expert B2B chemical industry video ad/content strategist. Your task is to generate a video strategy as a JSON object strictly adhering to the VideoStrategyLLMOutputSchema.', '{"temperature": 0.7, "maxTokens": 4096}', 'json', true),
('video_segment_scripting_agent', 'gemini-1.5-pro-latest', 'You are a creative scriptwriter and visual director. Your task is to generate detailed script and visual elements for a video segment as a JSON object strictly adhering to the VideoSegmentScriptingLLMOutputSchema.', '{"temperature": 0.7, "maxTokens": 2048}', 'json', true)
ON CONFLICT (agent_type) DO UPDATE 
SET 
  llm_model_name = EXCLUDED.llm_model_name,
  base_prompt = EXCLUDED.base_prompt,
  default_parameters = EXCLUDED.default_parameters,
  output_parser_type = EXCLUDED.output_parser_type,
  is_active = EXCLUDED.is_active,
  updated_at = NOW(); 