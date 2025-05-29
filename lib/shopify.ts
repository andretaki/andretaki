const SHOPIFY_SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN || process.env.SHOPIFY_STORE; // Support both variable names
const SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = '2024-04'; // Using a recent stable API version

if (!SHOPIFY_SHOP_DOMAIN || !SHOPIFY_ADMIN_ACCESS_TOKEN) {
  console.error(
    'Shopify environment variables SHOPIFY_SHOP_DOMAIN/SHOPIFY_STORE or SHOPIFY_ACCESS_TOKEN are not defined.'
  );
  // Depending on your app's startup, you might want to throw an error here
  // to prevent it from running without proper Shopify configuration.
  // For now, we'll let operations fail at runtime if these are missing.
}

const SHOPIFY_BASE_URL = `https://${SHOPIFY_SHOP_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}`;

async function shopifyFetch(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any) {
  if (!SHOPIFY_SHOP_DOMAIN || !SHOPIFY_ADMIN_ACCESS_TOKEN) {
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

// Product-related interfaces
export interface ShopifyProductVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string | null;
  position: number;
  inventory_policy: string;
  compare_at_price: string | null;
  fulfillment_service: string;
  inventory_management: string | null;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  created_at: string;
  updated_at: string;
  taxable: boolean;
  barcode: string | null;
  grams: number;
  weight: number;
  weight_unit: string;
  inventory_item_id: number;
  inventory_quantity: number;
  old_inventory_quantity: number;
  requires_shipping: boolean;
  admin_graphql_api_id: string;
}

export interface ShopifyProductImage {
  id: number;
  product_id: number;
  position: number;
  created_at: string;
  updated_at: string;
  alt: string | null;
  width: number;
  height: number;
  src: string;
  variant_ids: number[];
  admin_graphql_api_id: string;
}

export interface ShopifyProductOption {
  id: number;
  product_id: number;
  name: string;
  position: number;
  values: string[];
}

export interface ShopifyMetafield {
  id: number;
  namespace: string;
  key: string;
  value: any; // Can be string, number, JSON string
  type: string; // e.g., 'single_line_text_field', 'json_string'
  description: string | null;
  owner_id: number;
  owner_resource: string;
  created_at: string;
  updated_at: string;
  admin_graphql_api_id: string;
}

export interface ShopifyProduct {
  id: number; // This is Shopify's product ID
  title: string;
  body_html: string | null; // Description
  vendor: string;
  product_type: string;
  created_at: string;
  handle: string;
  updated_at: string;
  published_at: string | null;
  template_suffix: string | null;
  status: 'active' | 'archived' | 'draft';
  published_scope: string;
  tags: string; // comma-separated string
  admin_graphql_api_id: string;
  variants: ShopifyProductVariant[];
  options: ShopifyProductOption[];
  images: ShopifyProductImage[];
  image: ShopifyProductImage | null; // Main product image
  // Metafields are usually fetched separately or via GraphQL
}

interface GetShopifyProductsResponse {
  products: ShopifyProduct[];
}

interface GetShopifyMetafieldsResponse {
  metafields: ShopifyMetafield[];
}

/**
 * Fetches a paginated list of products from Shopify.
 * Uses 'since_id' for cursor-based pagination.
 * Includes metafields if available through the product endpoint or fetches them separately.
 */
export async function getShopifyProducts(
  limit: number = 50,
  since_id?: string,
  fields: string = "id,title,body_html,vendor,product_type,created_at,handle,updated_at,published_at,status,tags,variants,options,images,image"
): Promise<{ products: ShopifyProduct[]; nextSinceId?: string }> {
  let endpoint = `products.json?limit=${limit}&fields=${fields}`;
  if (since_id) {
    endpoint += `&since_id=${since_id}`;
  }

  const { products: fetchedProducts } = await shopifyFetch(endpoint) as GetShopifyProductsResponse;

  if (!fetchedProducts || fetchedProducts.length === 0) {
    return { products: [] };
  }

  // Determine the next since_id for pagination
  // The last product in the current batch is the starting point for the next
  const nextSinceId = fetchedProducts.length === limit ? fetchedProducts[fetchedProducts.length - 1].id.toString() : undefined;

  // Optionally, fetch metafields for each product here if not included
  // This can be N+1, so consider GraphQL for efficiency if fetching many metafields often
  // For simplicity now, we'll assume essential metafields might be configured to show on product,
  // or a separate metafield sync step will occur.

  return { products: fetchedProducts, nextSinceId };
}

/**
 * Fetches all products from Shopify, handling pagination.
 */
export async function getAllShopifyProducts(
  onProgress?: (fetchedCount: number, totalCountEstimate?: number) => void // Optional progress callback
): Promise<ShopifyProduct[]> {
  let allProducts: ShopifyProduct[] = [];
  let sinceId: string | undefined = undefined;
  let pageCount = 0;
  const BATCH_SIZE = 250; // Max Shopify allows per page

  // Get total product count for progress estimation (optional)
  // const { count } = await shopifyFetch('products/count.json') as { count: number };
  // if (onProgress) onProgress(0, count);

  do {
    pageCount++;
    console.log(`Fetching product page ${pageCount}${sinceId ? ` (since_id: ${sinceId})` : ''}...`);
    const { products: batch, nextSinceId } = await getShopifyProducts(BATCH_SIZE, sinceId);
    
    if (batch.length === 0) {
      break;
    }

    allProducts = allProducts.concat(batch);
    sinceId = nextSinceId;

    if (onProgress) onProgress(allProducts.length); // Update progress
    
    // Shopify API rate limit: typically 2 requests/second (burst 40). Add a small delay.
    await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 second delay

  } while (sinceId);

  return allProducts;
}

/**
 * Fetches metafields for a specific resource (e.g., product).
 */
export async function getShopifyMetafields(
  resource: 'products' | 'variants' | 'collections' | 'orders' | 'customers',
  resourceId: number
): Promise<ShopifyMetafield[]> {
  const { metafields } = await shopifyFetch(
    `${resource}/${resourceId}/metafields.json`
  ) as GetShopifyMetafieldsResponse;
  return metafields || [];
} 