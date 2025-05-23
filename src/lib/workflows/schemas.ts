import { z } from 'zod';

export const ChemicalApplicationSchema = z.object({
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