import {
  pgTable, serial, text, timestamp, jsonb, boolean, integer, varchar, decimal, index, bigint, smallint, AnyPgColumn,
  PgTimestampConfig,
  IndexBuilder,
  ForeignKeyBuilder,
  uniqueIndex,
  customType
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { pgSchema, primaryKey } from 'drizzle-orm/pg-core';

// --- Custom Types for PostgreSQL specific features ---
const customVector = (name: string, { dimensions }: { dimensions: number }) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(',')}]`;
    },
    fromDriver(value: string): number[] {
      if (value === null || typeof value !== 'string') return [];
      try {
        const cleanedValue = value.replace(/^\[|\]$/g, '');
        if (cleanedValue === '') return [];
        return cleanedValue.split(',').map(v => parseFloat(v.trim()));
      } catch (e) {
        console.error(`Error parsing vector string: "${value}"`, e);
        return [];
      }
    },
  })(name);

const customTsvector = (name: string) =>
  customType<{ data: string; driverData: string }>({
    dataType() {
      return 'tsvector';
    },
  })(name);

// Define schemas based on user's DDL
export const ragSystemSchema = pgSchema('rag_system');
export const marketingSchema = pgSchema('marketing');
// public schema is default, no need to define separately unless using specific features

// --- RAG System Tables ---
export const documents = ragSystemSchema.table('documents', {
  id: serial('id').primaryKey(),
  source_identifier: varchar('source_identifier', { length: 512 }).notNull(),
  source_type: varchar('source_type', { length: 50 }).notNull(),
  name: varchar('name', { length: 512 }).notNull(),
  type: varchar('type', { length: 100 }),
  size: integer('size'),
  num_pages: integer('num_pages'),
  uploaded_at: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  last_modified_at: timestamp('last_modified_at', { withTimezone: true }).defaultNow().notNull(),
  processing_status: varchar('processing_status', { length: 50 }).default('pending').notNull(),
  extracted_metadata: jsonb('extracted_metadata'),
  content_hash: varchar('content_hash', { length: 64 }),
  access_control_tags: jsonb('access_control_tags'),
  source_url: text('source_url'),
  document_version: integer('document_version').default(1).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idx_rag_documents_source_type: index('idx_rag_documents_source_type').on(table.source_type),
  idx_rag_documents_source_identifier: index('idx_rag_documents_source_identifier').on(table.source_identifier),
}));

export const chunks = ragSystemSchema.table('chunks', {
  id: serial('id').primaryKey(),
  document_id: integer('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  chunk_hash: varchar('chunk_hash', { length: 64 }),
  metadata: jsonb('metadata').notNull(),
  chunk_type: text('chunk_type').default('text').notNull(),
  word_count: integer('word_count'),
  char_count: integer('char_count'),
  parent_chunk_id: integer('parent_chunk_id').references((): AnyPgColumn => chunks.id, { onDelete: 'set null' }),
  confidence_score: smallint('confidence_score').default(70),
  chunk_last_modified: timestamp('chunk_last_modified', { withTimezone: true }).defaultNow().notNull(),
  chunk_version: integer('chunk_version').default(1).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  content_embedding: customVector('content_embedding', { dimensions: 1536 }).notNull(),
  access_control_tags: jsonb('access_control_tags'),
  content_tsv: customTsvector('content_tsv'),
}, (table) => ({
  idx_rag_chunks_document_id: index('idx_rag_chunks_document_id').on(table.document_id),
  idx_chunks_chunk_hash: index('idx_chunks_chunk_hash').on(table.chunk_hash),
}));

export const syncState = ragSystemSchema.table('sync_state', {
  id: serial('id').primaryKey(),
  source_type: varchar('source_type', { length: 50 }).notNull().unique(),
  last_sync_timestamp: timestamp('last_sync_timestamp', { withTimezone: true }),
  last_sync_status: varchar('last_sync_status', { length: 50 }),
  last_cursor: text('last_cursor'),
  details: text('details'),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  sync_state_source_type_idx: index('sync_state_source_type_idx').on(table.source_type),
}));

export const shopifySyncState = ragSystemSchema.table('shopify_sync_state', {
  id: serial('id').primaryKey(),
  entity_type: varchar('entity_type', { length: 50 }).notNull().unique(),
  status: varchar('status', { length: 50 }).default('idle').notNull(),
  last_rest_since_id: bigint('last_rest_since_id', { mode: 'number' }),
  last_cursor: text('last_cursor'),
  last_sync_start_time: timestamp('last_sync_start_time', { withTimezone: true }),
  last_processed_count: integer('last_processed_count'),
  total_processed_count: integer('total_processed_count').default(0),
  last_error: text('last_error'),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idx_shopify_sync_state_entity_type: index('idx_shopify_sync_state_entity_type').on(table.entity_type),
  idx_shopify_sync_state_status: index('idx_shopify_sync_state_status').on(table.status),
}));

// --- Shopify Sync Data Tables (in rag_system schema as per user DDL) ---
export const shopifySyncProducts = ragSystemSchema.table('shopify_sync_products', {
  id: serial('id').primaryKey(),
  productId: bigint('product_id', { mode: 'number' }).unique(),
  title: text('title'),
  description: text('description'),
  productType: text('product_type'),
  vendor: text('vendor'),
  handle: text('handle'),
  status: text('status'),
  tags: text('tags'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  variants: jsonb('variants'),
  images: jsonb('images'),
  options: jsonb('options'),
  metafields: jsonb('metafields'),
  syncDate: timestamp('sync_date', { mode: 'date', withTimezone: false }).notNull(),
}, (table) => ({
  idx_shopify_products_updated_at: index('idx_shopify_products_updated_at').on(table.updatedAt),
  idx_shopify_products_handle: index('idx_shopify_products_handle').on(table.handle),
  idx_shopify_products_id: index('idx_shopify_products_id').on(table.productId),
}));

export const shopifySyncCustomers = ragSystemSchema.table('shopify_sync_customers', {
  id: serial('id').primaryKey(),
  customer_id: bigint('customer_id', { mode: 'number' }).unique(),
  first_name: text('first_name'),
  last_name: text('last_name'),
  email: text('email'),
  phone: text('phone'),
  verified_email: boolean('verified_email'),
  accepts_marketing: boolean('accepts_marketing'),
  orders_count: integer('orders_count'),
  state: text('state'),
  total_spent: decimal('total_spent', { precision: 12, scale: 2 }),
  note: text('note'),
  addresses: jsonb('addresses'),
  default_address: jsonb('default_address'),
  tax_exemptions: jsonb('tax_exemptions'),
  tax_exempt: boolean('tax_exempt'),
  tags: text('tags'),
  created_at: timestamp('created_at', { withTimezone: true }),
  updated_at: timestamp('updated_at', { withTimezone: true }),
  sync_date: timestamp('sync_date', { mode: 'date', withTimezone: false }).notNull(),
});

export const shopifySyncOrders = ragSystemSchema.table('shopify_sync_orders', {
  id: serial('id').primaryKey(),
    order_id: bigint('order_id', { mode: 'number' }).unique(),
    name: text('name'),
    order_number: integer('order_number'),
    customer_id: bigint('customer_id', { mode: 'number' }),
    email: text('email'),
    phone: text('phone'),
    financial_status: text('financial_status'),
    fulfillment_status: text('fulfillment_status'),
    processed_at: timestamp('processed_at', { withTimezone: true }),
    currency: text('currency'),
    total_price: decimal('total_price', { precision: 12, scale: 2 }),
    subtotal_price: decimal('subtotal_price', { precision: 12, scale: 2 }),
    total_tax: decimal('total_tax', { precision: 12, scale: 2 }),
    total_discounts: decimal('total_discounts', { precision: 12, scale: 2 }),
    total_shipping: decimal('total_shipping', { precision: 12, scale: 2 }),
    billing_address: jsonb('billing_address'),
    shipping_address: jsonb('shipping_address'),
    line_items: jsonb('line_items'),
    shipping_lines: jsonb('shipping_lines'),
    discount_applications: jsonb('discount_applications'),
    note: text('note'),
    tags: text('tags'),
    created_at: timestamp('created_at', { withTimezone: true }),
    updated_at: timestamp('updated_at', { withTimezone: true }),
    sync_date: timestamp('sync_date', { mode: 'date', withTimezone: false }).notNull(),
    first_name: text('first_name'),
    last_name: text('last_name'),
});

export const shopifySyncCollections = ragSystemSchema.table('shopify_sync_collections', {
  id: serial('id').primaryKey(),
    collection_id: bigint('collection_id', { mode: 'number' }).unique(),
    title: text('title'),
    handle: text('handle'),
  description: text('description'),
    description_html: text('description_html'),
    products_count: integer('products_count'),
    products: jsonb('products'),
    rule_set: jsonb('rule_set'),
    sort_order: text('sort_order'),
    published_at: timestamp('published_at', { withTimezone: true }),
    template_suffix: text('template_suffix'),
    updated_at: timestamp('updated_at', { withTimezone: true }),
    sync_date: timestamp('sync_date', { mode: 'date', withTimezone: false }).notNull(),
});

export const shopifySyncBlogArticles = ragSystemSchema.table('shopify_sync_blog_articles', {
  id: serial('id').primaryKey(),
    blog_id: bigint('blog_id', { mode: 'number' }),
    article_id: bigint('article_id', { mode: 'number' }),
    blog_title: text('blog_title'),
    title: text('title'),
    author: text('author'),
    content: text('content'),
    content_html: text('content_html'),
    excerpt: text('excerpt'),
    handle: text('handle'),
    image: jsonb('image'),
    tags: text('tags'),
    seo: jsonb('seo'),
    status: text('status'),
    published_at: timestamp('published_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }),
    updated_at: timestamp('updated_at', { withTimezone: true }),
    comments_count: integer('comments_count'),
    summary_html: text('summary_html'),
    template_suffix: text('template_suffix'),
    sync_date: timestamp('sync_date', { mode: 'date', withTimezone: false }).notNull(),
}, (table) => ({
    unique_blog_article_idx: uniqueIndex('unique_blog_article_idx').on(table.blog_id, table.article_id),
    idx_shopify_blog_articles_updated_at: index('idx_shopify_blog_articles_updated_at').on(table.updated_at),
    idx_shopify_blog_articles_published_at: index('idx_shopify_blog_articles_published_at').on(table.published_at),
    idx_shopify_blog_articles_handle: index('idx_shopify_blog_articles_handle').on(table.handle),
}));

// Need to define these tables that are referenced in relations
export const productApplications = marketingSchema.table('product_applications', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => shopifySyncProducts.id, { onDelete: 'cascade' }).notNull(),
  application: text('application').notNull(),
  description: text('description'),
  targetAudience: text('target_audience'),
  marketPotential: text('market_potential'),
  technicalComplexity: text('technical_complexity'),
  industry: text('industry'),
  useCase: text('use_case'),
  creativity: integer('creativity'),
  technicalDetails: text('technical_details'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idx_product_applications_product_id: index('idx_product_applications_product_id').on(table.productId),
}));

export const blogPosts = marketingSchema.table('blog_posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  productId: integer('product_id').references(() => shopifySyncProducts.id, { onDelete: 'set null' }),
  applicationId: integer('application_id').references(() => productApplications.id, { onDelete: 'set null' }),
  slug: text('slug'),
  outline: jsonb('outline'),
  status: varchar('status', { length: 50 }).default('draft'),
  metaDescription: text('meta_description'),
  keywords: jsonb('keywords'),
  wordCount: integer('word_count'),
  type: varchar('type', { length: 50 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idx_blog_posts_product_id: index('idx_blog_posts_product_id').on(table.productId),
  idx_blog_posts_application_id: index('idx_blog_posts_application_id').on(table.applicationId),
  idx_blog_posts_created_at: index('idx_blog_posts_created_at').on(table.createdAt),
}));

// --- Marketing Schema Tables ---
export const agentConfigurations = marketingSchema.table('agent_configurations', {
  id: serial('id').primaryKey(),
  agent_type: varchar('agent_type', { length: 100 }).notNull().unique(),
  llm_model_name: varchar('llm_model_name', { length: 100 }).notNull(),
  base_prompt: text('base_prompt').notNull(),
  default_parameters: jsonb('default_parameters'),
  output_parser_type: varchar('output_parser_type', { length: 50 }),
  is_active: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Zod schema for blog_outline data stored in content_pipeline
export const BlogOutlineDataSchema = z.object({
  final_title: z.string(),
  target_audience_persona: z.string(),
  primary_goal_of_article: z.string(),
  seo_meta_description: z.string(),
  seo_primary_keyword: z.string(),
  seo_secondary_keywords: z.array(z.string()),
  estimated_total_word_count: z.number().int(),
  introduction_summary: z.string(),
  sections: z.array(
    z.object({
      section_title: z.string(),
      estimated_word_count_section: z.number().int(),
      objective: z.string(),
      key_sub_points_or_questions: z.array(z.string()),
      suggested_h3_headings: z.array(z.string()).optional(),
      supporting_rag_themes_or_keywords: z.array(z.string()).optional(),
      key_takeaway_for_section: z.string(),
    })
  ),
  conclusion_summary: z.string(),
  call_to_action: z.object({
    text: z.string(),
    link_placeholder: z.string(),
  }),
  tone_and_style_notes: z.string(),
});
export type BlogOutlineData = z.infer<typeof BlogOutlineDataSchema>;

// Zod schema for blog_idea data
export const BlogIdeaDataSchema = z.object({
    suggested_title: z.string(),
    target_audience_segment: z.string(),
    core_concept: z.string(),
    key_points_suggestion: z.array(z.string()),
    novelty_justification: z.string(),
    primary_benefit_for_reader: z.string(),
    estimated_search_intent: z.string(),
    // Added fields to match innovatorAgent output
    source_focus: z.string().optional(), // To track what the idea was based on
});
export type BlogIdeaData = z.infer<typeof BlogIdeaDataSchema>;

export const contentPipeline = marketingSchema.table('content_pipeline', {
  id: serial('id').primaryKey(),
  task_type: varchar('task_type', { length: 100 }).notNull(), // e.g., 'blog_idea', 'blog_outline', 'blog_section_content', 'blog_draft_assembly'
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  source_document_ids: integer('source_document_ids').array(),
  source_chunk_ids: integer('source_chunk_ids').array(),
  related_pipeline_id: integer('related_pipeline_id').references(():AnyPgColumn => contentPipeline.id, { onDelete: 'set null' }),
  parent_task_id: integer('parent_task_id').references(():AnyPgColumn => contentPipeline.id, { onDelete: 'set null' }),
  title: text('title'), // Can be null if not applicable (e.g. for an array of ideas)
  summary: text('summary'),
  keywords: jsonb('keywords'),
  target_audience: text('target_audience'),
  data: jsonb('data').notNull(), // This will hold BlogIdeaData[], BlogOutlineData, or Markdown string for sections/draft
  assigned_to_agent_id: varchar('assigned_to_agent_id', { length: 100 }),
  priority: integer('priority').default(0),
  notes_for_review: text('notes_for_review'),
  error_message: text('error_message'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  completed_at: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  idx_marketing_content_pipeline_task_type_status: index('idx_marketing_content_pipeline_task_type_status').on(table.task_type, table.status),
  idx_marketing_content_pipeline_priority: index('idx_marketing_content_pipeline_priority_desc').on(table.priority),
  idx_content_pipeline_related_id_idx: index('idx_content_pipeline_related_id_idx').on(table.related_pipeline_id),
  idx_content_pipeline_parent_id_idx: index('idx_content_pipeline_parent_id_idx').on(table.parent_task_id),
}));

// --- Marketing Schema Relations ---
export const productsRelations = relations(shopifySyncProducts, ({ many }) => ({
  applications: many(productApplications, { relationName: 'ProductToApplications' }),
  blogPosts: many(blogPosts, { relationName: 'ProductToBlogPosts' }),
  // queueItems: many(contentQueue) // contentQueue is in public schema in user DDL
}));

export const productApplicationsRelations = relations(productApplications, ({ one, many }) => ({
  product: one(shopifySyncProducts, {
    fields: [productApplications.productId],
    references: [shopifySyncProducts.id],
    relationName: 'ProductToApplications'
  }),
  blogPosts: many(blogPosts, { relationName: 'ApplicationToBlogPosts' }),
}));

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  product: one(shopifySyncProducts, {
    fields: [blogPosts.productId],
    references: [shopifySyncProducts.id],
    relationName: 'ProductToBlogPosts'
  }),
  application: one(productApplications, {
    fields: [blogPosts.applicationId],
    references: [productApplications.id],
    relationName: 'ApplicationToBlogPosts'
  }),
  // videos: many(videos) // Assuming 'videos' table exists and is defined elsewhere if needed
}));

export const contentPipelineRelations = relations(contentPipeline, ({ one, many }) => ({
    relatedTask: one(contentPipeline, {
        fields: [contentPipeline.related_pipeline_id],
        references: [contentPipeline.id],
        relationName: 'PreviousStageTask'
    }),
    parentTask: one(contentPipeline, {
        fields: [contentPipeline.parent_task_id],
        references: [contentPipeline.id],
        relationName: 'ParentTaskForSubtask'
    }),
    subTasks: many(contentPipeline, {
        relationName: 'ParentTaskForSubtask'
    })
}));

// --- Types for Agents and Operations ---
export type Product = typeof shopifySyncProducts.$inferSelect;
export type NewProduct = typeof shopifySyncProducts.$inferInsert;
export type ProductApplication = typeof productApplications.$inferSelect; // singular for consistency
export type BlogPost = typeof blogPosts.$inferSelect;
// Video related types (if/when video tables are fully defined in marketing schema)
// export type Video = typeof videos.$inferSelect;
// export type VideoPersona = typeof videoPersonas.$inferSelect;
// export type VideoSegment = typeof videoSegments.$inferSelect;

export type ContentPipelineTask = typeof contentPipeline.$inferSelect; 