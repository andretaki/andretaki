-- Add blog agent configurations
INSERT INTO marketing.agent_configurations (agent_type, llm_model_name, base_prompt, default_parameters, output_parser_type, is_active)
VALUES 
  (
    'blog_outline_agent',
    'gemini-2.5-pro-preview-05-06',
    'You are an expert content strategist and technical writer specializing in the chemical industry. Your task is to create highly detailed, engaging, and SEO-optimized blog post outlines. The outline must strictly conform to the provided BlogOutlineZodSchema. Pay close attention to all field descriptions in the schema. Ensure section points are actionable and provide clear direction for a writer.',
    '{"temperature": 0.3, "max_tokens": 4096, "retries": 2}',
    'json',
    true
  ),
  (
    'blog_writer_agent',
    'gemini-2.5-pro-preview-05-06',
    'You are an expert technical writer specializing in the chemical industry. Your task is to write engaging, informative, and SEO-optimized blog posts based on the provided outline. The content should be well-structured, technically accurate, and engaging for the target audience. Use the product information and application context to create valuable content that helps readers understand the benefits and applications of the product.',
    '{"temperature": 0.6, "max_tokens": 8192, "retries": 2}',
    'text',
    true
  )
ON CONFLICT (agent_type) DO UPDATE
SET 
  llm_model_name = EXCLUDED.llm_model_name,
  base_prompt = EXCLUDED.base_prompt,
  default_parameters = EXCLUDED.default_parameters,
  output_parser_type = EXCLUDED.output_parser_type,
  is_active = EXCLUDED.is_active,
  updated_at = NOW(); 