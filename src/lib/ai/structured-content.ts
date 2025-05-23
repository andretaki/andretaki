import { z } from 'zod';
import { openai } from './client';
import type { Product } from '../types/product';

const ChemicalApplicationSchema = z.object({
  application: z.string(),
  industry: z.enum(['pharmaceutical', 'cosmetics', 'industrial', 'research', 'agriculture']),
  useCase: z.string(),
  technicalRequirements: z.object({
    purity: z.number().min(0).max(100),
    quantity: z.string(),
    storageConditions: z.array(z.string()),
  }),
  safetyLevel: z.enum(['low', 'medium', 'high', 'extreme']),
  regulatoryCompliance: z.array(z.string()),
  marketSize: z.number(),
  growthRate: z.number(),
});

export type ChemicalApplication = z.infer<typeof ChemicalApplicationSchema>;

export class StructuredContentAgent {
  async discoverApplications(product: Product) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-2024-04-09",
      messages: [
        {
          role: "system",
          content: "You are a chemical industry expert. Analyze products and suggest applications."
        },
        {
          role: "user",
          content: `Analyze ${product.title} (CAS: ${product.casNumber})`
        }
      ],
      response_format: { 
        type: "json_object",
        schema: z.array(ChemicalApplicationSchema)
      },
    });
    
    return JSON.parse(completion.choices[0].message.content || '[]') as ChemicalApplication[];
  }

  async generateProductDescription(product: Product) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-2024-04-09",
      messages: [
        {
          role: "system",
          content: "You are a chemical industry expert. Generate compelling product descriptions."
        },
        {
          role: "user",
          content: `Generate a product description for ${product.title} (CAS: ${product.casNumber})`
        }
      ],
      response_format: { 
        type: "json_object",
        schema: z.object({
          title: z.string(),
          shortDescription: z.string(),
          longDescription: z.string(),
          keyFeatures: z.array(z.string()),
          technicalSpecs: z.record(z.string()),
          safetyNotes: z.array(z.string()),
        })
      },
    });
    
    return JSON.parse(completion.choices[0].message.content || '{}');
  }
} 