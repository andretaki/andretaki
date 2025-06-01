import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { blogPosts, shopifySyncProducts, BlogMetadataZodSchema, type BlogMetadata } from '../../../../lib/db/schema';
import { eq } from 'drizzle-orm';
import { UpdateBlogSchema, formatZodError } from '../../../../lib/validations/api';

// Helper to transform single blog
function transformSingleBlog(blog: typeof blogPosts.$inferSelect, productTitle?: string | null) {
  // Use Zod schema to provide defaults for missing fields
  let metadata: BlogMetadata;
  try {
    metadata = BlogMetadataZodSchema.parse(blog.metadata || {});
  } catch {
    metadata = BlogMetadataZodSchema.parse({});
  }
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
    targetAudience: metadata.targetAudience,
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
    const rawBody = await request.json();
    const validation = UpdateBlogSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json({ 
        success: false, 
        error: "Invalid input for update", 
        details: formatZodError(validation.error)
      }, { status: 400 });
    }
    const body = validation.data;
    const currentBlog = await db.query.blogPosts.findFirst({ where: eq(blogPosts.id, blogId) });
    if (!currentBlog) {
      return NextResponse.json({ success: false, error: "Blog not found" }, { status: 404 });
    }
    const updatePayload: Partial<typeof blogPosts.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.title !== undefined) updatePayload.title = body.title;
    if (body.content !== undefined) {
      updatePayload.content = body.content;
      updatePayload.wordCount = typeof body.content === 'string' ? body.content.split(/\s+/).filter(Boolean).length : 0;
    }
    if (body.status !== undefined) updatePayload.status = body.status;
    if (body.metaDescription !== undefined) updatePayload.metaDescription = body.metaDescription;
    if (body.keywords !== undefined) updatePayload.keywords = body.keywords;
    if (body.productId !== undefined) updatePayload.productId = body.productId;
    if (body.applicationId !== undefined) updatePayload.applicationId = body.applicationId;
    if (body.slug !== undefined) updatePayload.slug = body.slug;
    if (body.metadata !== undefined) {
      const existingMetadata = (currentBlog.metadata || {}) as BlogMetadata;
      const mergedMetadata = { ...existingMetadata, ...body.metadata };
      const finalMetadataValidation = BlogMetadataZodSchema.safeParse(mergedMetadata);
      if (!finalMetadataValidation.success) {
        return NextResponse.json({ 
          success: false, 
          error: "Invalid metadata structure provided for update.", 
          details: formatZodError(finalMetadataValidation.error)
        }, { status: 400 });
      }
      updatePayload.metadata = finalMetadataValidation.data;
    }
    if (Object.keys(updatePayload).length <= 1) {
      const productForCurrent = currentBlog.productId ? await db.query.shopifySyncProducts.findFirst({columns: {title: true}, where: eq(shopifySyncProducts.id, currentBlog.productId)}) : null;
      return NextResponse.json({ success: true, blog: transformSingleBlog(currentBlog, productForCurrent?.title), message: "No effective changes provided." });
    }
    const updatedBlogArray = await db.update(blogPosts)
      .set(updatePayload)
      .where(eq(blogPosts.id, blogId))
      .returning();
    if (updatedBlogArray.length === 0) {
      return NextResponse.json({ success: false, error: 'Blog not found or update failed' }, { status: 404 });
    }
    const result = await db.select({ blog: blogPosts, productTitle: shopifySyncProducts.title })
      .from(blogPosts)
      .where(eq(blogPosts.id, blogId))
      .leftJoin(shopifySyncProducts, eq(blogPosts.productId, shopifySyncProducts.id))
      .limit(1);
    const blogData = result[0];
    if (!blogData || !blogData.blog) {
      return NextResponse.json({ success: false, error: 'Failed to retrieve updated blog details' }, { status: 500 });
    }
    const transformedBlog = transformSingleBlog(blogData.blog, blogData.productTitle);
    return NextResponse.json({ success: true, blog: transformedBlog, message: 'Blog updated successfully' });
  } catch (error: any) {
    console.error(`Failed to update blog ${params.id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to update blog', details: error.message },
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