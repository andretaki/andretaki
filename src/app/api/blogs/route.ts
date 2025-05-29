import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { blogPosts, shopifySyncProducts } from '../../../lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get blogs with product information
    const blogs = await db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        content: blogPosts.content,
        createdAt: blogPosts.createdAt,
        updatedAt: blogPosts.updatedAt,
        productId: blogPosts.productId,
        applicationId: blogPosts.applicationId,
        productTitle: shopifySyncProducts.title,
      })
      .from(blogPosts)
      .leftJoin(shopifySyncProducts, eq(blogPosts.productId, shopifySyncProducts.id))
      .orderBy(desc(blogPosts.createdAt))
      .limit(limit)
      .offset(offset);

    // Transform the data to match the frontend interface
    const transformedBlogs = blogs.map(blog => ({
      id: blog.id,
      title: blog.title,
      slug: blog.title?.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 250) || '',
      content: blog.content || '',
      status: 'published' as const, // Default since schema doesn't have status field yet
      createdAt: blog.createdAt.toISOString(),
      updatedAt: blog.updatedAt.toISOString(),
      productName: blog.productTitle || 'Unknown Product',
      targetAudience: 'Research Scientists', // Default since not in schema yet
      wordCount: blog.content ? blog.content.split(/\s+/).filter(w => w).length : 0,
      keywords: ['chemical', 'research'], // Default since not in schema yet
      metaDescription: blog.content ? blog.content.substring(0, 160) + '...' : '',
      views: Math.floor(Math.random() * 2000), // Mock data for now
      engagement: Math.floor(Math.random() * 100), // Mock data for now
    }));

    return NextResponse.json({
      success: true,
      blogs: transformedBlogs,
      total: transformedBlogs.length,
      hasMore: transformedBlogs.length === limit
    });

  } catch (error) {
    console.error('Failed to fetch blogs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blogs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      content,
      productId
    } = body;

    const newBlog = await db.insert(blogPosts).values({
      title: title || 'Untitled Blog Post',
      content: content || '',
      productId: productId || null
    }).returning();

    return NextResponse.json({
      success: true,
      blog: newBlog[0],
      message: 'Blog created successfully'
    });

  } catch (error) {
    console.error('Failed to create blog:', error);
    return NextResponse.json(
      { error: 'Failed to create blog', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      title,
      content
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Blog ID is required for updates' },
        { status: 400 }
      );
    }

    const updatedBlog = await db.update(blogPosts)
      .set({
        title,
        content,
        updatedAt: new Date()
      })
      .where(eq(blogPosts.id, id))
      .returning();

    if (updatedBlog.length === 0) {
      return NextResponse.json(
        { error: 'Blog not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      blog: updatedBlog[0],
      message: 'Blog updated successfully'
    });

  } catch (error) {
    console.error('Failed to update blog:', error);
    return NextResponse.json(
      { error: 'Failed to update blog', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Blog ID is required' },
        { status: 400 }
      );
    }

    const deletedBlog = await db.delete(blogPosts)
      .where(eq(blogPosts.id, parseInt(id)))
      .returning();

    if (deletedBlog.length === 0) {
      return NextResponse.json(
        { error: 'Blog not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Blog deleted successfully'
    });

  } catch (error) {
    console.error('Failed to delete blog:', error);
    return NextResponse.json(
      { error: 'Failed to delete blog', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 