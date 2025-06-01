import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { blogPosts, shopifySyncProducts } from '../../../lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get blogs with product information
    const blogsData = await db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        content: blogPosts.content,
        createdAt: blogPosts.createdAt,
        updatedAt: blogPosts.updatedAt,
        productId: blogPosts.productId,
        applicationId: blogPosts.applicationId,
        slug: blogPosts.slug,
        outline: blogPosts.outline,
        status: blogPosts.status,
        metaDescription: blogPosts.metaDescription,
        keywords: blogPosts.keywords,
        wordCount: blogPosts.wordCount,
        type: blogPosts.type,
        metadata: blogPosts.metadata,
        views: blogPosts.views,
        engagement: blogPosts.engagement,
        productTitle: shopifySyncProducts.title,
      })
      .from(blogPosts)
      .leftJoin(shopifySyncProducts, eq(blogPosts.productId, shopifySyncProducts.id))
      .orderBy(desc(blogPosts.createdAt))
      .limit(limit)
      .offset(offset);

    // Transform the data to match the frontend interface
    const transformedBlogs = blogsData.map(blog => {
      const metadata = (blog.metadata as any) || {}; // Ensure metadata is an object
      const calculatedSlug = blog.slug || blog.title?.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 250) || '';
      const calculatedWordCount = blog.wordCount || (blog.content ? blog.content.split(/\s+/).filter(w => w).length : 0);
      const calculatedMetaDescription = blog.metaDescription || (blog.content ? blog.content.substring(0, 160) + '...' : '');
      return {
        id: blog.id,
        title: blog.title,
        slug: calculatedSlug,
        content: blog.content || '',
        status: (blog.status as 'draft' | 'published' | 'archived') || 'draft',
        createdAt: blog.createdAt.toISOString(),
        updatedAt: blog.updatedAt.toISOString(),
        productName: blog.productTitle || 'Unknown Product',
        targetAudience: metadata.targetAudience || 'Research Scientists',
        wordCount: calculatedWordCount,
        keywords: (Array.isArray(blog.keywords) ? blog.keywords : []) as string[],
        metaDescription: calculatedMetaDescription,
        views: blog.views ?? Math.floor(Math.random() * 2000),
        engagement: blog.engagement ?? Math.floor(Math.random() * 100),
      };
    });

    const totalCountResult = await db.select({count: sql`count(*)::int`}).from(blogPosts);
    const total = totalCountResult[0]?.count || 0;

    return NextResponse.json({
      success: true,
      blogs: transformedBlogs,
      total: total,
      hasMore: (offset + transformedBlogs.length) < total
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
      productId,
      status,
      metaDescription,
      keywords,
      metadata
    } = body;

    if (!title) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    const slug = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').substring(0, 250);
    const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0;
    const newBlogArray = await db.insert(blogPosts).values({
      title: title,
      slug: slug,
      content: content || '',
      productId: productId || null,
      status: status || 'draft',
      metaDescription: metaDescription || '',
      keywords: keywords || [],
      wordCount: wordCount,
      metadata: metadata || {},
    }).returning();
    if (newBlogArray.length === 0) {
        return NextResponse.json({ error: 'Failed to create blog post' }, { status: 500 });
    }
    const newBlog = newBlogArray[0];
    // Fetch the newly created blog with product title for consistent response structure
    const result = await db
      .select({
        blog: blogPosts,
        productTitle: shopifySyncProducts.title,
      })
      .from(blogPosts)
      .where(eq(blogPosts.id, newBlog.id))
      .leftJoin(shopifySyncProducts, eq(blogPosts.productId, shopifySyncProducts.id))
      .limit(1);
    const blogData = result[0];
     if (!blogData || !blogData.blog) {
      return NextResponse.json({ error: 'Failed to retrieve created blog details' }, { status: 500 });
    }
    const metadataResponse = (blogData.blog.metadata as any) || {};
    const transformedBlog = {
        id: blogData.blog.id,
        title: blogData.blog.title,
        slug: blogData.blog.slug || '',
        content: blogData.blog.content || '',
        status: (blogData.blog.status as 'draft' | 'published' | 'archived') || 'draft',
        createdAt: blogData.blog.createdAt.toISOString(),
        updatedAt: blogData.blog.updatedAt.toISOString(),
        productName: blogData.productTitle || 'Unknown Product',
        targetAudience: metadataResponse.targetAudience || 'Research Scientists',
        wordCount: blogData.blog.wordCount || 0,
        keywords: (Array.isArray(blogData.blog.keywords) ? blogData.blog.keywords : []) as string[],
        metaDescription: blogData.blog.metaDescription || '',
        views: blogData.blog.views ?? null,
        engagement: blogData.blog.engagement ?? null,
        productId: blogData.blog.productId,
        applicationId: blogData.blog.applicationId,
        metadata: blogData.blog.metadata,
    };
    return NextResponse.json({
      success: true,
      blog: transformedBlog,
      message: 'Blog created successfully'
    }, { status: 201 });
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