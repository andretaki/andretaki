import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { blogPosts, type BlogMetadata, BlogMetadataZodSchema } from '../../../../../lib/db/schema';
import { eq } from 'drizzle-orm';
import { 
    createShopifyArticle, 
    updateShopifyArticle, 
    getShopifyBlogs, 
    type ShopifyArticleInput,
    type ShopifyArticleUpdateInput,
    type ShopifyArticle
} from '../../../../../lib/shopify/client';
import { marked } from 'marked';

// Helper to find a suitable Shopify Blog ID
async function getDefaultShopifyBlogId(): Promise<number | null> {
    try {
        const shopifyBlogsResponse = await getShopifyBlogs();
        if (shopifyBlogsResponse.blogs && shopifyBlogsResponse.blogs.length > 0) {
            // Try to find a blog with "news" in the title first
            const newsBlog = shopifyBlogsResponse.blogs.find(b => 
                b.title.toLowerCase().includes('news') || 
                b.title.toLowerCase().includes('blog')
            );
            if (newsBlog) return newsBlog.id;
            return shopifyBlogsResponse.blogs[0].id;
        }
        return null;
    } catch (error) {
        console.error("Failed to fetch Shopify blogs for default ID:", error);
        return null;
    }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const localBlogId = parseInt(params.id);
  if (isNaN(localBlogId)) {
    return NextResponse.json({ success: false, error: 'Invalid Blog ID.' }, { status: 400 });
  }

  let localBlog = await db.query.blogPosts.findFirst({
    where: eq(blogPosts.id, localBlogId),
  });

  if (!localBlog) {
    return NextResponse.json({ success: false, error: 'Blog post not found in local database.' }, { status: 404 });
  }
  
  if (!localBlog.title || !localBlog.content) {
    return NextResponse.json({ success: false, error: 'Blog title and content are required to publish.' }, { status: 400 });
  }

  try {
    // Parse and validate existing metadata
    const currentMetadata = BlogMetadataZodSchema.parse(localBlog.metadata || {});
    let shopifyBlogIdToUse = currentMetadata.shopifyBlogId;

    if (!shopifyBlogIdToUse) {
        shopifyBlogIdToUse = await getDefaultShopifyBlogId();
        if (!shopifyBlogIdToUse) {
            return NextResponse.json({ 
                success: false, 
                error: 'Could not determine Shopify Blog ID to publish to. Please configure it or ensure a blog exists on Shopify.' 
            }, { status: 500 });
        }
    }
    
    // Convert Markdown to HTML
    const htmlContent = marked.parse(localBlog.content);

    // Prepare base payload for both create and update
    const shopifyPayloadBase = {
        title: localBlog.title,
        body_html: htmlContent as string,
        author: currentMetadata.writerPersona || "ChemFlow AI Team",
        tags: Array.isArray(localBlog.keywords) ? localBlog.keywords.join(', ') : undefined,
        published: true,
        summary_html: localBlog.metaDescription || undefined,
        metafields: [
            {
                namespace: "seo",
                key: "description",
                value: localBlog.metaDescription || localBlog.title,
                type: "single_line_text_field"
            },
            {
                namespace: "custom",
                key: "chemflow_internal_id",
                value: localBlog.id.toString(),
                type: "single_line_text_field"
            }
        ]
    };

    let shopifyResponse: { article: ShopifyArticle };
    const existingShopifyArticleId = currentMetadata.shopifyArticleId;

    try {
        if (existingShopifyArticleId) {
            console.log(`Updating Shopify article ${existingShopifyArticleId} in blog ${shopifyBlogIdToUse}`);
            const updatePayload: ShopifyArticleUpdateInput = {
                id: existingShopifyArticleId,
                ...shopifyPayloadBase
            };
            shopifyResponse = await updateShopifyArticle(shopifyBlogIdToUse, existingShopifyArticleId, updatePayload);
        } else {
            console.log(`Creating new Shopify article in blog ${shopifyBlogIdToUse}`);
            const createPayload: ShopifyArticleInput = { ...shopifyPayloadBase };
            shopifyResponse = await createShopifyArticle(shopifyBlogIdToUse, createPayload);
        }
    } catch (shopifyError: any) {
        console.error('Shopify API error:', shopifyError);
        return NextResponse.json({ 
            success: false, 
            error: 'Failed to publish to Shopify.', 
            details: shopifyError.message || 'Unknown Shopify API error'
        }, { status: 500 });
    }

    if (!shopifyResponse || !shopifyResponse.article) {
        throw new Error('Failed to publish to Shopify or received an invalid response from Shopify.');
    }

    // Prepare updated metadata
    const updatedMetadata = BlogMetadataZodSchema.parse({
        ...currentMetadata,
        shopifyBlogId: shopifyResponse.article.blog_id,
        shopifyArticleId: shopifyResponse.article.id,
        shopifyHandle: shopifyResponse.article.handle,
        shopifyPublishedAt: shopifyResponse.article.published_at || new Date().toISOString(),
    });
    
    // Update local blog post
    try {
        await db.update(blogPosts)
            .set({
                status: 'published_on_shopify',
                metadata: updatedMetadata,
                updatedAt: new Date(),
            })
            .where(eq(blogPosts.id, localBlogId));
    } catch (dbError: any) {
        console.error('Failed to update local blog post:', dbError);
        // Even though local update failed, Shopify publish succeeded
        return NextResponse.json({ 
            success: true, 
            warning: 'Published to Shopify but failed to update local status.',
            error: dbError.message,
            shopifyArticleId: shopifyResponse.article.id,
            shopifyUrl: `https://${process.env.SHOPIFY_STORE}/blogs/${shopifyResponse.article.blog_id}/${shopifyResponse.article.handle}`
        });
    }

    return NextResponse.json({ 
        success: true, 
        message: `Blog post successfully ${existingShopifyArticleId ? 'updated' : 'published'} on Shopify!`,
        shopifyArticleId: shopifyResponse.article.id,
        shopifyUrl: `https://${process.env.SHOPIFY_STORE}/blogs/${shopifyResponse.article.blog_id}/${shopifyResponse.article.handle}`
    });

  } catch (error: any) {
    console.error(`Failed to publish blog ID ${params.id} to Shopify:`, error);
    return NextResponse.json(
        { success: false, error: 'Failed to publish to Shopify.', details: error.message },
        { status: 500 }
    );
  }
} 