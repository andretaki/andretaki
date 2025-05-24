-- Migration file: 003_add_video_script_prompt.sql

INSERT INTO marketing.agent_configurations (
    agent_type,
    llm_model_name,
    base_prompt,
    default_parameters,
    output_parser_type
) VALUES (
    'video_script',
    'gemini-pro',
    'Create a video script for the following chemical product:
      
Product: {{PRODUCT_TITLE}}
Chemical Formula: {{PRODUCT_FORMULA}}
CAS Number: {{PRODUCT_CAS}}
Properties: {{PRODUCT_PROPERTIES}}

Blog Content:
{{BLOG_CONTENT}}

Video Requirements:
Platform: {{PLATFORM}}
Duration: {{DURATION}} seconds
Style: {{STYLE}}
Voice Type: {{VOICE_TYPE}}
Include Subtitles: {{INCLUDE_SUBTITLES}}
{{TEMPLATE}}
{{VISUAL_STYLE}}
{{MOLECULAR_VISUALIZATION}}

The script should include:
1. A compelling title and description
2. A well-structured script with timestamps
3. Visual cues for each section:
   - Molecular animations ({{MOLECULAR_VISUALIZATION}})
   - Chemical reactions
   - Real-world applications
   - Safety demonstrations
   - Text overlays
4. Voice instructions:
   - Tone and pace
   - Words to emphasize
   - Pauses and transitions
5. Branding elements:
   - Logo placement
   - Color scheme ({{VISUAL_STYLE}})
   - Watermark
6. Visual style specifications:
   {{VISUAL_STYLE}}

{{TEMPLATE}}

Format the response as a JSON object with all required fields.
Ensure the script is engaging and educational while maintaining technical accuracy.',
    '{"temperature": 0.7, "max_tokens": 4000}',
    'json'
); 