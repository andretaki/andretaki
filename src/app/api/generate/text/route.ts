import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API || '');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      prompt, 
      model = 'gemini-2.5-pro-preview-05-06', 
      temperature = 0.7, 
      max_tokens = 8000, // User increased
    } = body;

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (!process.env.GOOGLE_AI_API) {
      return NextResponse.json(
        { success: false, error: 'Google AI API key not configured' },
        { status: 500 }
      );
    }

    let modelName = 'gemini-2.5-pro-preview-05-06'; // Forcing as per user context
    
    console.log(`[generate/text] Using model: ${modelName} for prompt (first 100 chars): ${prompt.substring(0, 100)}...`);

    const geminiModel = genAI.getGenerativeModel({ 
      model: modelName
    });

    const generationConfig = {
      temperature: Math.min(Math.max(temperature, 0), 1), 
      maxOutputTokens: Math.min(max_tokens, 16384), // User increased
      candidateCount: 1,
      // stopSequences: [], // Generally not needed unless specific issues arise
    };

    console.log(`[generate/text] Calling Gemini with config:`, generationConfig);

    const result = await geminiModel.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig
    });

    const response = await result.response;
    const generatedText = response.text(); // This is the critical part

    console.log(`[generate/text] Generated text length: ${generatedText ? generatedText.length : 'undefined'}`);
    
    if (!generatedText || generatedText.trim().length === 0) {
      console.error('[generate/text] Gemini returned empty or whitespace-only response.');
      // Log more details to understand why it might be empty
      console.error('[generate/text] Prompt that caused empty response (first 500 chars):', prompt.substring(0, 500) + (prompt.length > 500 ? '...' : ''));
      console.error('[generate/text] Full Gemini response object:', JSON.stringify(response, null, 2));
      
      let detailMessage = 'The model generated no usable content. This could be due to content filtering, an issue with the prompt, or an internal model error.';
      const finishReason = response.candidates?.[0]?.finishReason;
      const safetyRatings = response.candidates?.[0]?.safetyRatings;

      if (finishReason) {
        detailMessage += ` Finish Reason: ${finishReason}.`;
      }
      if (safetyRatings) {
        detailMessage += ` Safety Ratings: ${JSON.stringify(safetyRatings)}.`;
      }

      return NextResponse.json(
        { 
          success: false, 
          error: 'Gemini returned empty or whitespace-only response',
          details: detailMessage,
          model: modelName,
          promptUsed: prompt.substring(0, 200) + "...",
          geminiResponseObject: response // Send back the whole response for the agent to inspect if needed
        },
        { status: 500 } // Important to send a non-200 status
      );
    }

    return NextResponse.json({
      success: true,
      generatedText,
      model: modelName,
      usage: { // Approximated as Gemini API doesn't return detailed token counts for REST API like OpenAI
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0,
      }
    });

  } catch (error) {
    console.error('[generate/text] Critical error in text generation API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during text generation';
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate text due to an exception', 
        details: errorMessage,
        stack: errorStack,
      },
      { status: 500 }
    );
  }
} 