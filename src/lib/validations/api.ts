import { z } from 'zod';
import { BlogMetadataZodSchema, BlogOutlineZodSchema } from '../db/schema';

// Blog Creation Schema
export const CreateBlogSchema = z.object({
    title: z.string().min(1, "Title is required").max(250),
    content: z.string().optional().nullable(),
    productId: z.number().int().positive().optional().nullable(),
    applicationId: z.number().int().positive().optional().nullable(),
    status: z.enum(['draft', 'published', 'archived', 'published_on_shopify']).optional().default('draft'),
    metaDescription: z.string().max(2000).optional().nullable(),
    keywords: z.array(z.string()).optional().nullable(),
    metadata: BlogMetadataZodSchema.optional().default({
        targetAudience: "Research Scientists",
        blogTone: BlogOutlineZodSchema.shape.tone.options[0],
        technicalDepthLevel: BlogOutlineZodSchema.shape.technicalDepth.options[0],
    }),
});

// Blog Update Schema
export const UpdateBlogSchema = z.object({
    title: z.string().min(1).max(250).optional(),
    content: z.string().optional().nullable(),
    productId: z.number().int().positive().optional().nullable(),
    applicationId: z.number().int().positive().optional().nullable(),
    status: z.enum(['draft', 'published', 'archived', 'published_on_shopify']).optional(),
    metaDescription: z.string().max(2000).optional().nullable(),
    keywords: z.array(z.string()).optional().nullable(),
    metadata: BlogMetadataZodSchema.partial().optional(),
    slug: z.string().max(250).optional().nullable(),
});

// Content Generation Schemas
export const GenerateOutlineSchema = z.object({
    pipelineTaskId: z.number().int().positive("Pipeline Task ID must be a positive integer."),
});

export const GenerateFullBlogSchema = z.object({
    outlineTaskId: z.number().int().positive("Outline Task ID must be a positive integer."),
});

// Title Similarity Check Schema
export const CheckTitleSimilaritySchema = z.object({
    title: z.string().min(1, "Title is required").max(250),
    excludeBlogId: z.number().int().positive().optional(),
});

// Helper function to handle Zod validation errors
export function formatZodError(error: z.ZodError) {
    const formatted = error.format();
    const messages: string[] = [];
    
    // Recursively collect error messages
    function collectMessages(obj: any, path: string[] = []) {
        if (obj._errors) {
            messages.push(`${path.join('.')}: ${obj._errors.join(', ')}`);
        }
        for (const key in obj) {
            if (key !== '_errors' && typeof obj[key] === 'object') {
                collectMessages(obj[key], [...path, key]);
            }
        }
    }
    
    collectMessages(formatted);
    return messages;
} 