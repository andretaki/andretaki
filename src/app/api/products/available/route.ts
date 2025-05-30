import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { shopifySyncProducts } from '../../../../lib/db/schema';
import { desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Fetch recent products from Shopify sync
    const products = await db.query.shopifySyncProducts.findMany({
      orderBy: [desc(shopifySyncProducts.updatedAt)],
      limit: 10
    });

    // Extract useful product info
    const productList = products.map(product => ({
      id: product.id,
      title: product.title,
      type: product.productType,
      tags: product.tags
    }));

    return NextResponse.json({
      success: true,
      products: productList,
      count: products.length
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch products', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 