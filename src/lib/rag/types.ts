import { z } from 'zod';

// Document Types
export const DocumentSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type Document = z.infer<typeof DocumentSchema>;

// Chunk Types
export const ChunkSchema = z.object({
  id: z.number(),
  documentId: z.number(),
  content: z.string(),
  contentEmbedding: z.array(z.number()).length(1536), // OpenAI ada-002 embedding dimension
  metadata: z.record(z.unknown()).optional(),
  confidenceScore: z.number(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type Chunk = z.infer<typeof ChunkSchema>;

// Query Result Types
export const QueryResultSchema = z.object({
  id: z.number(),
  content: z.string(),
  metadata: z.record(z.unknown()).optional(),
  documentId: z.number(),
  documentName: z.string(),
  confidenceScore: z.number(),
  similarity: z.number()
});

export type QueryResult = z.infer<typeof QueryResultSchema>;

// Query Response Types
export const QueryResponseSchema = z.object({
  chunks: z.array(QueryResultSchema)
});

export type QueryResponse = z.infer<typeof QueryResponseSchema>;

// Query Parameters
export const QueryParamsSchema = z.object({
  query: z.string(),
  topK: z.number().min(1).max(100).default(5),
  minConfidence: z.number().min(0).max(100).default(70)
});

export type QueryParams = z.infer<typeof QueryParamsSchema>; 