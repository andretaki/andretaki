import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const llmClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const {
      prompt,
      model = "claude-3-opus-20240229",
      max_tokens = 3000,
      temperature = 0.7,
    } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const completion = await llmClient.messages.create({
      model: model,
      max_tokens: max_tokens,
      temperature: temperature,
      messages: [{ role: "user", content: prompt }],
    });
    const generatedText = completion.content[0].type === 'text' ? completion.content[0].text : '';
    
    return NextResponse.json({ generatedText });

  } catch (error: any) {
    console.error('Text Generation API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate text' }, { status: 500 });
  }
} 