import { NextRequest, NextResponse } from 'next/server';
import { runInnovatorAgent } from '../../../../lib/agents/innovator-agent';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      focusType = 'general_theme',
      focusValue,
      targetAudience,
      contentType,
      productInfo,
      keywords,
      focusAreas
    } = body;

    // Enhance focus value with additional context
    let enhancedFocusValue = focusValue;
    if (productInfo?.name && productInfo.name !== focusValue) {
      enhancedFocusValue = `${productInfo.name} - ${focusValue}`;
    }

    // Build focus areas context
    let contextualFocusAreas = focusAreas || '';
    if (keywords && keywords.length > 0) {
      contextualFocusAreas += `\nKey topics: ${keywords.join(', ')}`;
    }
    if (productInfo?.description) {
      contextualFocusAreas += `\nProduct context: ${productInfo.description}`;
    }

    const result = await runInnovatorAgent({
      focusType: focusType,
      focusValue: enhancedFocusValue,
      targetAudience: targetAudience,
      numIdeasPerApplication: 3 // Generate multiple ideas for better content
    });

    return NextResponse.json({
      success: result.success,
      message: result.message,
      contentType,
      metadata: {
        productInfo,
        keywords,
        focusAreas: contextualFocusAreas,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Blog generation API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate blog content', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 