import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { blogPosts, shopifySyncProducts, type BlogPost } from '../../../lib/db/schema';
import { eq, desc, asc, sql, like, or, and, SQL } from 'drizzle-orm';

// Define valid sort columns and their corresponding table columns
const validSortColumns = {
  title: blogPosts.title,
  status: blogPosts.status,
  createdAt: blogPosts.createdAt,
  updatedAt: blogPosts.updatedAt,
  wordCount: blogPosts.wordCount,
  views: blogPosts.views,
  engagement: blogPosts.engagement,
  productName: shopifySyncProducts.title,
} as const;

type ValidSortColumn = keyof typeof validSortColumns;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10'); // Default to 10 for better UX
    const offset = parseInt(searchParams.get('offset') || '0');
    const searchTerm = searchParams.get('searchTerm') || '';
    const status = searchParams.get('status') || 'all';
    const sortBy = (searchParams.get('sortBy') || 'updatedAt') as ValidSortColumn;
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Validate sort column
    if (!validSortColumns[sortBy]) {
      return NextResponse.json(
        { error: `Invalid sort column: ${sortBy}. Valid columns are: ${Object.keys(validSortColumns).join(', ')}` },
        { status: 400 }
      );
    }

    // Build conditions
    const conditions: SQL[] = [];
    if (searchTerm) {
      conditions.push(
        or(
          like(blogPosts.title, `%${searchTerm}%`),
          like(blogPosts.metaDescription, `%${searchTerm}%`),
          like(shopifySyncProducts.title, `%${searchTerm}%`),
          sql`${blogPosts.keywords}::text ILIKE ${`%${searchTerm}%`}`
        )
      );
    }
    if (status !== 'all') {
      conditions.push(eq(blogPosts.status, status));
    }

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
      .where(conditions.length > 0 ? and(...conditions) : sql`1=1`) // Use a true condition when no filters
      .orderBy(sortOrder === 'asc' ? asc(validSortColumns[sortBy]) : desc(validSortColumns[sortBy]))
      .limit(limit)
      .offset(offset);

    // Transform the data to match the frontend interface
    const transformedBlogs = blogsData.map((blog): BlogPost & { productName: string } => {
      const metadata = (blog.metadata as any) || {};
      const calculatedSlug = blog.slug || blog.title?.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 250) || '';
      const calculatedWordCount = blog.wordCount || (blog.content ? blog.content.split(/\s+/).filter((w: string) => w).length : 0);
      const calculatedMetaDescription = blog.metaDescription || (blog.content ? blog.content.substring(0, 160) + '...' : '');
      
      // Ensure keywords is always an array of strings
      let keywords: string[] = [];
      if (Array.isArray(blog.keywords)) {
        keywords = blog.keywords;
      } else if (typeof blog.keywords === 'string') {
        keywords = blog.keywords.split(',').map(k => k.trim());
      }

      return {
        id: blog.id,
        title: blog.title,
        slug: calculatedSlug,
        content: blog.content || '',
        status: (blog.status as 'draft' | 'published' | 'archived') || 'draft',
        createdAt: blog.createdAt,
        updatedAt: blog.updatedAt,
        productName: blog.productTitle || 'Unknown Product',
        wordCount: calculatedWordCount,
        keywords,
        metaDescription: calculatedMetaDescription,
        views: blog.views ?? 0,
        engagement: blog.engagement ?? 0,
        productId: blog.productId,
        applicationId: blog.applicationId,
        outline: blog.outline,
        type: blog.type,
        metadata: blog.metadata,
      };
    });

    // Get total count with the same filters
    const totalCountResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(blogPosts)
      .leftJoin(shopifySyncProducts, eq(blogPosts.productId, shopifySyncProducts.id))
      .where(conditions.length > 0 ? and(...conditions) : sql`1=1`); // Use the same condition as above
    const total = totalCountResult[0]?.count || 0;

    return NextResponse.json({
      success: true,
      blogs: transformedBlogs,
      total,
      hasMore: (offset + transformedBlogs.length) < total,
      limit,
      offset
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