import { pgTable, serial, text, timestamp, jsonb, boolean, integer, varchar, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { pgSchema } from 'drizzle-orm/pg-core';

// Define schemas
export const ragSystemSchema = pgSchema('rag_system');
export const marketingSchema = pgSchema('marketing');

// RAG System Tables
export const documents = ragSystemSchema.table('documents', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const chunks = ragSystemSchema.table('chunks', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  contentEmbedding: text('content_embedding').notNull(), // This will be a vector type in PostgreSQL
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  confidenceScore: decimal('confidence_score', { precision: 5, scale: 2 }).default('1.00'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => ({
  documentIdIdx: index('chunks_document_id_idx').on(table.documentId),
  contentEmbeddingIdx: index('chunks_content_embedding_idx').on(table.contentEmbedding)
}));

// RAG System Relations
export const documentsRelations = relations(documents, ({ many }) => ({
  chunks: many(chunks)
}));

export const chunksRelations = relations(chunks, ({ one }) => ({
  document: one(documents, {
    fields: [chunks.documentId],
    references: [documents.id]
  })
}));

// Products from Shopify
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  shopifyId: varchar('shopify_id', { length: 255 }).notNull().unique(),
  handle: text('handle').unique().notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  vendor: text('vendor'),
  productType: text('product_type'),
  tags: text('tags').array(),
  price: decimal('price', { precision: 10, scale: 2 }),
  chemicalFormula: varchar('chemical_formula', { length: 100 }),
  casNumber: varchar('cas_number', { length: 100 }),
  properties: jsonb('properties').$type<Record<string, any>>(),
  safetyInfo: jsonb('safety_info').$type<Record<string, any>>(),
  applications: text('applications').array(),
  isActive: boolean('is_active').default(true),
  lastSynced: timestamp('last_synced').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Generated applications by AI
export const productApplications = pgTable('product_applications', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id).notNull(),
  application: varchar('application', { length: 255 }).notNull(),
  industry: varchar('industry', { length: 255 }).notNull(),
  useCase: text('use_case').notNull(),
  technicalDetails: text('technical_details'),
  safetyConsiderations: text('safety_considerations'),
  regulatoryCompliance: jsonb('regulatory_compliance').$type<string[]>(),
  environmentalImpact: text('environmental_impact'),
  costEffectiveness: text('cost_effectiveness'),
  creativity: integer('creativity').notNull(),
  marketPotential: integer('market_potential').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Blog Outline Schema
export const BlogOutlineZodSchema = z.object({
  title: z.string().max(70, "Title should be 70 characters or less").describe("Compelling, SEO-friendly blog post title."),
  hook: z.string().min(50, "Hook should be at least 50 characters").describe("Engaging opening (1-3 sentences) to capture reader interest and state the post's purpose."),
  targetAudience: z.string().describe("Specific target audience for this blog post (e.g., R&D Scientists, Lab Managers, Procurement Specialists, Students)."),
  persona: z.string().describe("Assumed persona of the writer (e.g., Lead Chemist, Industry Analyst, Technical Expert, Seasoned Educator)."),
  tone: z.enum(['technical_deep_dive', 'informative_overview', 'problem_solution', 'case_study_focused', 'thought_leadership', 'educational_tutorial'])
    .describe("Overall tone and style of the blog post."),
  technicalDepth: z.enum(['beginner', 'intermediate', 'expert'])
    .describe("Level of technical detail required. Beginner assumes little prior knowledge, expert can use jargon and complex concepts."),
  sections: z.array(
    z.object({
      title: z.string().describe("Catchy and descriptive title for this section."),
      points: z.array(z.string()).min(1).describe("Key bullet points, subtopics, or questions to address in this section. These should be actionable for the writer."),
      keyTakeaways: z.array(z.string()).optional().describe("Main takeaways or summary points for this section."),
      estimatedWordCount: z.number().int().positive().optional().describe("Estimated word count for this section."),
    })
  ).min(3, "Must have at least 3 sections").max(7, "Should not exceed 7 sections").describe("Main sections of the blog post."),
  conclusion: z.string().min(50, "Conclusion should be at least 50 characters").describe("Strong concluding paragraph summarizing key points, reinforcing the main message, and offering a final thought."),
  cta: z.object({
    text: z.string().describe("Call-to-action text (e.g., 'Learn More about [Product]', 'Request a Sample', 'Contact Our Experts')."),
    linkPlaceholder: z.string().describe("Placeholder for the CTA link (e.g., '/product/[slug]', '/contact-us', 'datasheet-download-link').")
  }).describe("Relevant call-to-action for the reader."),
  seoElements: z.object({
    primaryKeyword: z.string().describe("The main SEO keyword/keyphrase for the post."),
    secondaryKeywords: z.array(z.string()).min(2).describe("At least 2-3 supporting LSI or secondary keywords."),
    metaDescription: z.string().min(70, "Meta description should be 70-160 characters").max(160, "Meta description should be 70-160 characters").describe("SEO meta description."),
    internalLinkSuggestions: z.array(z.string().url().or(z.string().startsWith('/'))).optional().describe("Suggestions for internal links (e.g., related product pages, other blog posts - provide relative paths or full URLs)."),
    externalLinkSuggestions: z.array(z.string().url()).optional().describe("Suggestions for relevant external authoritative links (full URLs)."),
  }).describe("SEO related elements for the blog post."),
  estimatedTotalWordCount: z.number().int().positive().describe("Estimated total word count for the blog post."),
}).describe("Schema for a comprehensive and actionable blog post outline.");

export type BlogOutline = z.infer<typeof BlogOutlineZodSchema>;

// Blog content
export const blogPosts = pgTable('blog_posts', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id).notNull(),
  applicationId: integer('application_id').references(() => productApplications.id),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  outline: jsonb('outline').$type<BlogOutline>(),
  content: text('content').notNull(),
  excerpt: text('excerpt'),
  seoTitle: text('seo_title'),
  metaDescription: text('meta_description'),
  keywords: text('keywords').array(),
  type: varchar('type', { length: 20 }).$type<'blog' | 'safety' | 'safety_series'>().default('blog'),
  metadata: jsonb('metadata').$type<{
    safetyLevel?: 'basic' | 'intermediate' | 'advanced';
    targetAudience?: string;
    writerPersona?: string;
    blogTone?: BlogOutline['tone'];
    technicalDepthLevel?: BlogOutline['technicalDepth'];
  }>(),
  status: varchar('status', { length: 20 }).$type<'draft' | 'published' | 'archived'>().default('draft'),
  wordCount: integer('word_count'),
  readingTime: integer('reading_time'), // in minutes
  scheduledFor: timestamp('scheduled_for'),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// NEW: Video Personas
export const videoPersonas = pgTable('video_personas', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  style_prompt_modifier: text('style_prompt_modifier').notNull(),
  humor_style: text('humor_style').notNull(),
  visual_theme_keywords: text('visual_theme_keywords').array(),
  voice_characteristics: jsonb('voice_characteristics').$type<{
    style: string;
    pitch?: string;
    speed?: string;
  }>(),
  music_style_keywords: text('music_style_keywords').array(),
  example_video_urls: text('example_video_urls').array(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// NEW: Video Segments
export const videoSegments = pgTable('video_segments', {
  id: serial('id').primaryKey(),
  videoId: integer('video_id').references(() => videos.id, { onDelete: 'cascade' }).notNull(),
  segment_order: integer('segment_order').notNull(),
  segment_type: varchar('segment_type', { length: 50 }).notNull(),
  duration_seconds: integer('duration_seconds').notNull(),
  
  // Content Sources
  source_blog_post_id: integer('source_blog_post_id').references(() => blogPosts.id, { onDelete: 'set null' }),
  source_product_id: integer('source_product_id').references(() => products.id, { onDelete: 'set null' }),
  source_application_id: integer('source_application_id').references(() => productApplications.id, { onDelete: 'set null' }),
  source_safety_data_sheet_id: integer('source_safety_data_sheet_id'),

  // AI Generated Content
  narration_script: text('narration_script'),
  visual_concept_description: text('visual_concept_description'),
  visual_generation_prompts: jsonb('visual_generation_prompts').$type<string[]>(),
  text_overlay_content: text('text_overlay_content').array(),
  
  // Generated Assets
  generated_visual_asset_url: text('generated_visual_asset_url'),
  generated_voiceover_asset_url: text('generated_voiceover_asset_url'),
  
  status: varchar('status', { length: 20 }).$type<'pending' | 'scripting' | 'visualizing' | 'voicing' | 'editing' | 'completed' | 'failed'>().default('pending'),
  error_message: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => ({
  videoIdOrderIdx: index('video_segments_video_id_order_idx').on(table.videoId, table.segment_order),
}));

// MODIFY: videos table
export const videos = pgTable('videos', {
  id: serial('id').primaryKey(),
  blogPostId: integer('blog_post_id').references(() => blogPosts.id, { onDelete: 'set null' }),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  videoPersonaId: integer('video_persona_id').references(() => videoPersonas.id, { onDelete: 'set null' }),

  platform: varchar('platform', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  
  overall_concept_prompt: text('overall_concept_prompt'),
  target_audience_description: text('target_audience_description'),
  keywords: text('keywords').array(),

  status: varchar('status', { length: 20 }).$type<'planning' | 'segment_generation' | 'asset_generation' | 'editing' | 'rendering' | 'completed' | 'failed'>().default('planning'),
  
  scheduledFor: timestamp('scheduled_for'),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => ({
  productIdIdx: index('videos_product_id_idx').on(table.productId),
  videoPersonaIdIdx: index('videos_video_persona_idx').on(table.videoPersonaId),
}));

// Content generation queue
export const contentQueue = pgTable('content_queue', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id).notNull(),
  contentType: varchar('content_type', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).$type<'pending' | 'processing' | 'completed' | 'failed'>().default('pending'),
  priority: integer('priority').default(0),
  scheduledFor: timestamp('scheduled_for'),
  completedAt: timestamp('completed_at'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// System activity log
export const activityLog = pgTable('activity_log', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 50 }).notNull(),
  entity: varchar('entity', { length: 50 }).notNull(),
  entityId: integer('entity_id'),
  action: text('action').notNull(),
  details: jsonb('details').$type<Record<string, any>>(),
  success: boolean('success').default(true),
  duration: integer('duration'), // in milliseconds
  createdAt: timestamp('created_at').defaultNow()
});

// Agent configurations
export const agentConfigurations = marketingSchema.table('agent_configurations', {
  id: serial('id').primaryKey(),
  agent_type: varchar('agent_type', { length: 100 }).notNull().unique(),
  llm_model_name: varchar('llm_model_name', { length: 100 }).notNull(),
  base_prompt: text('base_prompt').notNull(),
  default_parameters: jsonb('default_parameters'),
  output_parser_type: varchar('output_parser_type', { length: 50 }),
  is_active: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Relations
export const productsRelations = relations(products, ({ many }) => ({
  applications: many(productApplications),
  blogPosts: many(blogPosts),
  queueItems: many(contentQueue)
}));

export const productApplicationsRelations = relations(productApplications, ({ one, many }) => ({
  product: one(products, {
    fields: [productApplications.productId],
    references: [products.id],
  }),
  blogPosts: many(blogPosts),
}));

export const blogPostsRelations = relations(blogPosts, ({ one, many }) => ({
  product: one(products, {
    fields: [blogPosts.productId],
    references: [products.id],
  }),
  application: one(productApplications, {
    fields: [blogPosts.applicationId],
    references: [productApplications.id],
  }),
  videos: many(videos)
}));

export const videosRelations = relations(videos, ({ one, many }) => ({
  blogPost: one(blogPosts, {
    fields: [videos.blogPostId],
    references: [blogPosts.id]
  }),
  product: one(products, {
    fields: [videos.productId],
    references: [products.id]
  }),
  videoPersona: one(videoPersonas, {
    fields: [videos.videoPersonaId],
    references: [videoPersonas.id]
  }),
  segments: many(videoSegments),
}));

export const videoSegmentsRelations = relations(videoSegments, ({ one }) => ({
  video: one(videos, {
    fields: [videoSegments.videoId],
    references: [videos.id],
  }),
  sourceBlogPost: one(blogPosts, {
    fields: [videoSegments.source_blog_post_id],
    references: [blogPosts.id],
  }),
  sourceProduct: one(products, {
    fields: [videoSegments.source_product_id],
    references: [products.id],
  }),
  sourceApplication: one(productApplications, {
    fields: [videoSegments.source_application_id],
    references: [productApplications.id],
  }),
}));

// Types
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductApplications = typeof productApplications.$inferSelect;
export type BlogPost = typeof blogPosts.$inferSelect;
export type Video = typeof videos.$inferSelect;
export type QueueItem = typeof contentQueue.$inferSelect;
export type VideoPersona = typeof videoPersonas.$inferSelect;
export type VideoSegment = typeof videoSegments.$inferSelect;

// Content Pipeline
export const contentPipeline = marketingSchema.table('content_pipeline', {
  id: serial('id').primaryKey(),
  task_type: varchar('task_type', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).$type<'pending' | 'in_progress' | 'completed' | 'failed' | 'error'>().default('pending'),
  title: varchar('title', { length: 255 }).notNull(),
  summary: text('summary'),
  target_audience: varchar('target_audience', { length: 255 }),
  data: jsonb('data').$type<Record<string, any>>(),
  source_chunk_ids: integer('source_chunk_ids').array(),
  source_document_ids: integer('source_document_ids').array(),
  related_pipeline_id: integer('related_pipeline_id'),
  keywords: jsonb('keywords').$type<string[]>(),
  error_message: text('error_message'),
  completed_at: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}); 