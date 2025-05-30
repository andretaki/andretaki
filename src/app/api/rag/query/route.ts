import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { shopifySyncProducts } from '../../../../lib/db/schema';
import { sql, ilike, or } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, topK = 3 } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Search in product titles, descriptions, and tags
    const products = await db.query.shopifySyncProducts.findMany({
      where: or(
        ilike(shopifySyncProducts.title, `%${query}%`),
        ilike(shopifySyncProducts.description, `%${query}%`),
        ilike(shopifySyncProducts.tags, `%${query}%`)
      ),
      limit: topK,
      orderBy: [sql`similarity(${shopifySyncProducts.title}, ${query}) DESC`]
    });

    // Transform the results into the expected format
    const chunks = products.map(product => ({
      id: product.id,
      document_id: product.id,
      document_name: product.title,
      content: `${product.title}\n\n${product.description || ''}\n\nTags: ${product.tags || ''}`,
      score: 1.0, // Since we're doing direct matching, we'll use a default score
      metadata: {
        product_type: product.product_type,
        vendor: product.vendor,
        handle: product.handle,
        status: product.status,
        published_at: product.published_at,
        variants: product.variants,
        images: product.images,
        options: product.options,
        metafields: product.metafields
      }
    }));

    return NextResponse.json({
      success: true,
      chunks
    });

  } catch (error) {
    console.error('Product search error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to search products', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 