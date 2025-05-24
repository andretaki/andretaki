const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE;
const SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = '2024-04'; // Using a recent stable API version

if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ADMIN_ACCESS_TOKEN) {
  console.error(
    'Shopify environment variables SHOPIFY_STORE or SHOPIFY_ACCESS_TOKEN are not defined.'
  );
  // Depending on your app's startup, you might want to throw an error here
  // to prevent it from running without proper Shopify configuration.
  // For now, we'll let operations fail at runtime if these are missing.
}

const SHOPIFY_BASE_URL = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}`;

async function shopifyFetch(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any) {
  if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ADMIN_ACCESS_TOKEN) {
    throw new Error(
      'Shopify store domain or admin access token is not configured.'
    );
  }
  
  const options: RequestInit = {
    method,
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN!,
      'Content-Type': 'application/json',
    },
    // Revalidate cache less frequently for Shopify admin data, or not at all for mutations
    next: { revalidate: method === 'GET' ? 60 : 0 } // Revalidate GETs every 60s, no cache for mutations
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${SHOPIFY_BASE_URL}/${endpoint}`, options);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Shopify API Error: ${response.status} ${response.statusText}`, errorBody);
    throw new Error(`Shopify API request failed: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  if (response.status === 204) { // No Content
    return null;
  }

  return response.json();
}

export interface ShopifyBlog {
  id: number;
  handle: string;
  title: string;
  created_at: string;
  updated_at: string;
  commentable: string;
  feedburner: any; // Adjust type as needed
  feedburner_location: any; // Adjust type as needed
  tags: string;
  template_suffix: string | null;
  admin_graphql_api_id: string;
}

export interface ShopifyArticleInput {
  title: string;
  author?: string;
  tags?: string; // comma-separated
  body_html: string;
  published?: boolean;
  image?: { src: string; alt?: string };
  summary_html?: string;
  metafields?: { key: string; value: string; type: string; namespace: string }[];
}

export interface ShopifyArticle extends ShopifyArticleInput {
  id: number;
  blog_id: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  handle: string;
  user_id: number | null;
  template_suffix: string | null;
  admin_graphql_api_id: string;
}

export async function getShopifyBlogs(): Promise<{ blogs: ShopifyBlog[] }> {
  return shopifyFetch('blogs.json');
}

export async function createShopifyArticle(
  blogId: number,
  article: ShopifyArticleInput
): Promise<{ article: ShopifyArticle }> {
  return shopifyFetch(`blogs/${blogId}/articles.json`, 'POST', { article });
}

export async function getShopifyArticles(blogId: number): Promise<{ articles: ShopifyArticle[] }> {
  return shopifyFetch(`blogs/${blogId}/articles.json`);
}

// Optional: Add functions for update and delete as you expand
/*
export async function updateShopifyArticle(
  blogId: number,
  articleId: number,
  article: Partial<ShopifyArticleInput>
): Promise<{ article: ShopifyArticle }> {
  return shopifyFetch(`blogs/${blogId}/articles/${articleId}.json`, 'PUT', { article });
}

export async function deleteShopifyArticle(blogId: number, articleId: number): Promise<null> {
  return shopifyFetch(`blogs/${blogId}/articles/${articleId}.json`, 'DELETE');
}
*/ 