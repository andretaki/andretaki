import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { blogPosts, shopifySyncProducts } from '../../../../lib/db/schema';
import { eq } from 'drizzle-orm';

// Helper to transform single blog
function transformSingleBlog(blog: typeof blogPosts.$inferSelect, productTitle?: string | null) {
  const metadata = (blog.metadata as any) || {};
  const slug = blog.slug || blog.title?.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 250) || '';
  const wordCount = blog.wordCount || (blog.content ? blog.content.split(/\s+/).filter(w => w).length : 0);
  const metaDescription = blog.metaDescription || (blog.content ? blog.content.substring(0, 160) + '...' : '');
  return {
    id: blog.id,
    title: blog.title,
    slug: slug,
    content: blog.content || '',
    status: (blog.status as 'draft' | 'published' | 'archived') || 'draft',
    createdAt: blog.createdAt.toISOString(),
    updatedAt: blog.updatedAt.toISOString(),
    productName: productTitle || 'Unknown Product',
    targetAudience: metadata.targetAudience || 'Research Scientists',
    wordCount: wordCount,
    keywords: (Array.isArray(blog.keywords) ? blog.keywords : []) as string[],
    metaDescription: metaDescription,
    views: blog.views ?? null,
    engagement: blog.engagement ?? null,
    productId: blog.productId,
    applicationId: blog.applicationId,
    metadata: blog.metadata,
  };
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const blogId = parseInt(params.id);
    if (isNaN(blogId)) {
      return NextResponse.json({ success: false, error: 'Invalid blog ID' }, { status: 400 });
    }
    const result = await db
      .select({
        blog: blogPosts,
        productTitle: shopifySyncProducts.title,
      })
      .from(blogPosts)
      .where(eq(blogPosts.id, blogId))
      .leftJoin(shopifySyncProducts, eq(blogPosts.productId, shopifySyncProducts.id))
      .limit(1);
    const blogData = result[0];
    if (!blogData || !blogData.blog) {
      return NextResponse.json({ success: false, error: 'Blog not found' }, { status: 404 });
    }
    const transformedBlog = transformSingleBlog(blogData.blog, blogData.productTitle);
    return NextResponse.json({ success: true, blog: transformedBlog });
  } catch (error) {
    console.error(`Failed to fetch blog ${params.id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch blog', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const blogId = parseInt(params.id);
    if (isNaN(blogId)) {
      return NextResponse.json({ success: false, error: 'Invalid blog ID' }, { status: 400 });
    }
    const body = await request.json();
    const {
      title,
      content,
      status,
      metaDescription,
      keywords,
      productId,
      applicationId,
      metadata,
      slug,
    } = body;
    const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0;
    const finalSlug = slug || (title ? title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').substring(0, 250) : undefined);
    const updatePayload: Partial<typeof blogPosts.$inferInsert> = {
        updatedAt: new Date(),
    };
    if (title !== undefined) updatePayload.title = title;
    if (content !== undefined) updatePayload.content = content;
    if (status !== undefined) updatePayload.status = status;
    if (metaDescription !== undefined) updatePayload.metaDescription = metaDescription;
    if (keywords !== undefined) updatePayload.keywords = keywords;
    if (productId !== undefined) updatePayload.productId = productId;
    if (applicationId !== undefined) updatePayload.applicationId = applicationId;
    if (metadata !== undefined) updatePayload.metadata = metadata;
    if (finalSlug !== undefined) updatePayload.slug = finalSlug;
    if (content !== undefined) updatePayload.wordCount = wordCount;
    if (Object.keys(updatePayload).length <= 1) {
        const currentBlog = await db.query.blogPosts.findFirst({where: eq(blogPosts.id, blogId)});
        if (!currentBlog) return NextResponse.json({ success: false, error: "Blog not found" }, { status: 404 });
        const currentBlogWithProduct = await db.select({blog: blogPosts, productTitle: shopifySyncProducts.title})
            .from(blogPosts)
            .where(eq(blogPosts.id, blogId))
            .leftJoin(shopifySyncProducts, eq(blogPosts.productId, shopifySyncProducts.id)).limit(1);
        return NextResponse.json({ success: true, blog: transformSingleBlog(currentBlogWithProduct[0].blog, currentBlogWithProduct[0].productTitle), message: "No effective changes provided." });
    }
    const updatedBlogArray = await db.update(blogPosts)
      .set(updatePayload)
      .where(eq(blogPosts.id, blogId))
      .returning();
    if (updatedBlogArray.length === 0) {
      return NextResponse.json({ success: false, error: 'Blog not found or no changes made' }, { status: 404 });
    }
    const result = await db
      .select({
        blog: blogPosts,
        productTitle: shopifySyncProducts.title,
      })
      .from(blogPosts)
      .where(eq(blogPosts.id, blogId))
      .leftJoin(shopifySyncProducts, eq(blogPosts.productId, shopifySyncProducts.id))
      .limit(1);
    if (!result[0] || !result[0].blog) {
        return NextResponse.json({ success: false, error: 'Failed to retrieve updated blog details' }, { status: 500 });
    }
    const transformedBlog = transformSingleBlog(result[0].blog, result[0].productTitle);
    return NextResponse.json({
      success: true,
      blog: transformedBlog,
      message: 'Blog updated successfully'
    });
  } catch (error) {
    console.error(`Failed to update blog ${params.id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to update blog', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const blogId = parseInt(params.id);
    if (isNaN(blogId)) {
      return NextResponse.json({ success: false, error: 'Invalid blog ID' }, { status: 400 });
    }
    const deletedBlog = await db.delete(blogPosts)
      .where(eq(blogPosts.id, blogId))
      .returning();
    if (deletedBlog.length === 0) {
      return NextResponse.json({ success: false, error: 'Blog not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Blog deleted successfully' });
  } catch (error) {
    console.error(`Failed to delete blog ${params.id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete blog', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 