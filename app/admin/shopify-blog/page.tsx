import { getShopifyBlogs, getShopifyArticles, ShopifyBlog, ShopifyArticle } from '@/lib/shopify';
import { createArticleAction } from './actions';
import React from 'react';
import { useFormState, useFormStatus } from 'react-dom';

const initialState = {
  message: null,
  success: false,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? 'Creating...' : 'Create Article'}
    </button>
  );
}

const articleHtmlTemplate = `
<!-- 
  Paste this basic structure into the 'Content (HTML)' field below.
  Then, fill it with your article's content.
  Ensure the CSS (provided separately) is active in your Shopify theme.
-->
<header id="extraction-header">
    <h1>YOUR MAIN ARTICLE TITLE HERE</h1>
    <p class="subtitle">Your compelling subtitle or brief introduction.</p>
    <nav class="article-nav">
        <a href="#section1">Section 1 Link</a>
        <a href="#section2">Section 2 Link</a>
    </nav>
</header>

<main class="article-main">
    <section id="section1">
        <h2>Section 1 Title</h2>
        <p>Content for section 1. You can use <strong>strong tags</strong>, <em>em tags</em>, and <a href="#">links</a>.</p>
        <img src="URL_TO_YOUR_IMAGE.JPG" alt="Descriptive alt text" class="img-medium" loading="lazy">
        
        <h3>Subsection Title</h3>
        <p>More detailed content here.</p>
        
        <ul>
            <li>List item 1</li>
            <li>List item 2</li>
        </ul>

        <div class="info-box">
            <h4>Informational Note</h4>
            <p>This is an informational box. Use it for tips or related facts.</p>
        </div>
    </section>

    <section id="section2">
        <h2>Section 2 Title</h2>
        <p>Content for section 2.</p>
        
        <div class="highlight-box">
            <h4>Key Takeaway</h4>
            <p>Highlight important points or summaries here.</p>
        </div>

        <div class="warning-box">
            <h4>Important Warning or Caution</h4>
            <p>Use this for critical safety information or disclaimers.</p>
        </div>
    </section>

    <!-- Optional: Product Spotlight Section -->
    <section id="product-spotlight-example">
        <h2>Related Products</h2>
        <div class="product-spotlight">
            <div class="product-card">
                <h4>Product Name 1</h4>
                <p>Brief description of the product.</p>
                <a href="URL_TO_PRODUCT1" class="btn-small">View Product</a>
            </div>
        </div>
    </section>

    <!-- Optional: Call to Action -->
    <div class="cta">
        <h2>Your Call to Action Title</h2>
        <p>Encourage readers to take the next step.</p>
        <a href="URL_TO_ACTION" class="btn">Primary Action</a>
    </div>
</main>
`;

function CreateArticleForm({ blogs }: { blogs: ShopifyBlog[] }) {
  const [state, formAction] = useFormState(createArticleAction, initialState);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [showTemplate, setShowTemplate] = React.useState(false);

  React.useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4 p-6 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-md max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Create New Shopify Article</h2>
      
      {state.message && (
        <p className={`text-sm p-2 rounded ${state.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {state.message}
        </p>
      )}

      <div>
        <label htmlFor="blogId" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Select Blog:
        </label>
        <select
          id="blogId"
          name="blogId"
          required
          className="mt-1 block w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        >
          {blogs.map((blog) => (
            <option key={blog.id} value={blog.id}>
              {blog.title} (ID: {blog.id})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Shopify Article Title (for SEO & listings):
        </label>
        <input
          type="text"
          id="title"
          name="title"
          required
          className="mt-1 block w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div>
        <label htmlFor="author" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Author (optional):
        </label>
        <input
          type="text"
          id="author"
          name="author"
          className="mt-1 block w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div>
        <label htmlFor="tags" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Tags (comma-separated, optional):
        </label>
        <input
          type="text"
          id="tags"
          name="tags"
          className="mt-1 block w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div>
        <div className="flex justify-between items-center">
          <label htmlFor="body_html" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Content (HTML - use the provided template structure):
          </label>
          <button 
            type="button" 
            onClick={() => setShowTemplate(!showTemplate)}
            className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            {showTemplate ? 'Hide' : 'Show'} HTML Template
          </button>
        </div>
        {showTemplate && (
          <div className="mt-2 p-3 bg-neutral-100 dark:bg-neutral-700 rounded border border-neutral-300 dark:border-neutral-600">
            <p className="text-xs text-neutral-600 dark:text-neutral-300 mb-2">Copy and paste the structure below into the textarea. Replace placeholder text and URLs. The CSS (provided separately) must be active in your Shopify theme.</p>
            <pre className="text-xs whitespace-pre-wrap break-all overflow-auto max-h-60 p-2 bg-white dark:bg-neutral-800 rounded">
              <code>{articleHtmlTemplate.trim()}</code>
            </pre>
          </div>
        )}
        <textarea
          id="body_html"
          name="body_html"
          rows={25}
          required
          className="mt-1 block w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono text-xs"
          placeholder="Paste your article HTML structure here. Click 'Show HTML Template' above for a starting point."
        />
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Note: The Shopify Article Title above is for SEO and general listing. The H1 inside your HTML content can be the same or different.
        </p>
      </div>
      <div className="flex items-center">
        <input
          id="published"
          name="published"
          type="checkbox"
          defaultChecked
          className="h-4 w-4 text-indigo-600 border-neutral-300 dark:border-neutral-600 rounded focus:ring-indigo-500"
        />
        <label htmlFor="published" className="ml-2 block text-sm text-neutral-900 dark:text-neutral-100">
          Publish immediately
        </label>
      </div>
      <SubmitButton />
    </form>
  );
}

export default async function ShopifyBlogAdminPage() {
  let blogs: ShopifyBlog[] = [];
  let articlesByBlog: Record<number, {data: ShopifyArticle[], error?: string}> = {};
  let pageError: string | null = null;

  try {
    const blogsData = await getShopifyBlogs();
    blogs = blogsData.blogs;

    if (blogs.length > 0) {
      for (const blog of blogs) {
        try {
          const articlesData = await getShopifyArticles(blog.id);
          articlesByBlog[blog.id] = { data: articlesData.articles };
        } catch (articleError: any) {
          console.error(`Failed to load articles for blog ${blog.id}:`, articleError);
          articlesByBlog[blog.id] = { data: [], error: `Could not load articles for this blog.` };
        }
      }
    }
  } catch (e: any) {
    console.error("Failed to load Shopify blogs data:", e);
    pageError = e.message || "Failed to load Shopify blogs. Check Shopify credentials and connection.";
    if (e.message.includes('Shopify store domain or admin access token is not configured')) {
        pageError = "Shopify environment variables (SHOPIFY_STORE, SHOPIFY_ACCESS_TOKEN) are missing or incorrect in .env.local. Please check them.";
    } else if (e.message.includes('401')) {
        pageError = "Shopify API Authentication failed (401). Check your SHOPIFY_ACCESS_TOKEN.";
    } else if (e.message.includes('404')) {
        pageError = "Shopify store not found (404). Check your SHOPIFY_STORE domain.";
    }
  }

  if (pageError) {
    return (
      <div className="p-8 font-sans">
        <div className="max-w-2xl mx-auto p-6 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg">
          <h1 className="text-2xl font-bold text-red-700 dark:text-red-200">Error Loading Shopify Data</h1>
          <p className="mt-2 text-red-600 dark:text-red-300">{pageError}</p>
          <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
            Please ensure `SHOPIFY_STORE` and `SHOPIFY_ACCESS_TOKEN` are correctly set in your `.env.local` file and that your Shopify store is accessible.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4 sm:p-8 space-y-8 font-sans bg-neutral-50 dark:bg-neutral-900 min-h-screen">
      <header className="max-w-4xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-neutral-100">Shopify Blog Management</h1>
      </header>
      
      {blogs.length > 0 ? (
        <CreateArticleForm blogs={blogs} />
      ) : (
        <div className="max-w-2xl mx-auto p-6 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <h2 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200">No Blogs Found</h2>
          <p className="mt-2 text-yellow-700 dark:text-yellow-300">
            No blogs were found in your Shopify store. You need to create at least one blog in your Shopify Admin (Online Store {'->'} Blog posts {'->'} Manage blogs) before you can add articles.
          </p>
        </div>
      )}

      <section className="mt-12 max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold mb-6 text-neutral-900 dark:text-neutral-100">Existing Blogs & Articles</h2>
        {blogs.map((blog) => (
          <div key={blog.id} className="mb-8 p-6 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow">
            <h3 className="text-xl font-semibold text-indigo-700 dark:text-indigo-400">{blog.title} <span className="text-sm text-neutral-500 dark:text-neutral-400">(ID: {blog.id})</span></h3>
            {articlesByBlog[blog.id]?.error && (
                 <p className="text-red-500 dark:text-red-400 mt-2">{articlesByBlog[blog.id]?.error}</p>
            )}
            {articlesByBlog[blog.id]?.data && articlesByBlog[blog.id].data.length > 0 ? (
              <ul className="list-disc pl-5 mt-3 space-y-2">
                {articlesByBlog[blog.id].data.map((article) => (
                  <li key={article.id} className="text-neutral-700 dark:text-neutral-300">
                    <strong className="font-medium">{article.title}</strong>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">
                      {' '}(Author: {article.author || 'N/A'}, Published: {article.published_at ? new Date(article.published_at).toLocaleDateString() : 'No'}{'>'})
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              !articlesByBlog[blog.id]?.error && <p className="text-neutral-500 dark:text-neutral-400 mt-2">No articles in this blog yet.</p>
            )}
          </div>
        ))}
        {blogs.length === 0 && !pageError && (
            <p className="text-neutral-600 dark:text-neutral-400">Once blogs are created in Shopify, they will appear here.</p>
        )}
      </section>
    </div>
  );
} 