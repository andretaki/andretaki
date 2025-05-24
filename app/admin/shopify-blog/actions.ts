'use server';

import { revalidatePath } from 'next/cache';
import { createShopifyArticle, ShopifyArticleInput } from '@/lib/shopify'; // Ensure your tsconfig.json has paths setup for @/*

export async function createArticleAction(prevState: any, formData: FormData) {
  const blogId = formData.get('blogId') as string;
  const title = formData.get('title') as string;
  const body_html = formData.get('body_html') as string;
  const author = formData.get('author') as string;
  const tags = formData.get('tags') as string;
  const published = formData.get('published') === 'on'; // Checkbox value

  if (!blogId || !title || !body_html) {
    return { message: 'Error: Blog ID, Title, and Content are required.', success: false };
  }

  const articleInput: ShopifyArticleInput = {
    title,
    body_html,
    author: author || undefined,
    tags: tags || undefined,
    published: published,
  };

  try {
    await createShopifyArticle(Number(blogId), articleInput);
    revalidatePath('/admin/shopify-blog'); // Revalidate the page to show the new article
    return { message: 'Article created successfully!', success: true };
  } catch (error: any) {
    console.error('Failed to create article:', error);
    return { message: error.message || 'Failed to create article.', success: false };
  }
} 