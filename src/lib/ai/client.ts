import OpenAI from 'openai';
import { z } from 'zod';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is not set');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to parse structured outputs
export async function parseStructuredOutput<T extends z.ZodType>(
  schema: T,
  prompt: string,
  systemMessage: string = "You are a helpful AI assistant."
): Promise<z.infer<T>> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo-2024-04-09",
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object", schema },
  });

  return completion.choices[0].message.content as z.infer<T>;
} 