-- Migration file: 004_create_shopify_sync_tables.sql

-- Create rag_system schema (since the code expects this schema but DB uses rag_core)
CREATE SCHEMA IF NOT EXISTS rag_system;
ALTER SCHEMA rag_system OWNER TO "default";

-- Create shopify_sync_state table
CREATE TABLE rag_system.shopify_sync_state (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'idle' NOT NULL,
    last_rest_since_id BIGINT,
    last_cursor TEXT,
    last_sync_start_time TIMESTAMP WITH TIME ZONE,
    last_processed_count INTEGER,
    total_processed_count INTEGER DEFAULT 0,
    last_error TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE rag_system.shopify_sync_state OWNER TO "default";

CREATE INDEX idx_shopify_sync_state_entity_type ON rag_system.shopify_sync_state(entity_type);
CREATE INDEX idx_shopify_sync_state_status ON rag_system.shopify_sync_state(status);

-- Create shopify_sync_products table
CREATE TABLE rag_system.shopify_sync_products (
    id SERIAL PRIMARY KEY,
    product_id BIGINT UNIQUE, -- Shopify's product ID
    title TEXT,
    description TEXT,
    product_type TEXT,
    vendor TEXT,
    handle TEXT,
    status TEXT,
    tags TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    variants JSONB,
    images JSONB,
    options JSONB,
    metafields JSONB,
    sync_date DATE NOT NULL,
    -- Chemical-specific fields
    chemical_formula VARCHAR(100),
    cas_number VARCHAR(100),
    properties JSONB,
    safety_info JSONB
);

ALTER TABLE rag_system.shopify_sync_products OWNER TO "default";

CREATE INDEX idx_shopify_sync_products_product_id ON rag_system.shopify_sync_products(product_id);
CREATE INDEX idx_shopify_sync_products_handle ON rag_system.shopify_sync_products(handle);
CREATE INDEX idx_shopify_sync_products_status ON rag_system.shopify_sync_products(status);
CREATE INDEX idx_shopify_sync_products_cas_number ON rag_system.shopify_sync_products(cas_number);

-- Create shopify_sync_customers table
CREATE TABLE rag_system.shopify_sync_customers (
    id SERIAL PRIMARY KEY,
    customer_id BIGINT UNIQUE,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    verified_email BOOLEAN,
    accepts_marketing BOOLEAN,
    orders_count INTEGER,
    state TEXT,
    total_spent DECIMAL(12,2),
    note TEXT,
    addresses JSONB,
    default_address JSONB,
    tax_exemptions JSONB,
    tax_exempt BOOLEAN,
    tags TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    sync_date DATE NOT NULL
);

ALTER TABLE rag_system.shopify_sync_customers OWNER TO "default";

-- Create shopify_sync_orders table
CREATE TABLE rag_system.shopify_sync_orders (
    id SERIAL PRIMARY KEY,
    order_id BIGINT UNIQUE,
    name TEXT,
    order_number INTEGER,
    customer_id BIGINT,
    email TEXT,
    phone TEXT,
    financial_status TEXT,
    fulfillment_status TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    currency TEXT,
    total_price DECIMAL(12,2),
    subtotal_price DECIMAL(12,2),
    total_tax DECIMAL(12,2),
    total_discounts DECIMAL(12,2),
    total_shipping DECIMAL(12,2),
    billing_address JSONB,
    shipping_address JSONB,
    line_items JSONB,
    shipping_lines JSONB,
    discount_applications JSONB,
    note TEXT,
    tags TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    sync_date DATE NOT NULL,
    first_name TEXT,
    last_name TEXT
);

ALTER TABLE rag_system.shopify_sync_orders OWNER TO "default";

-- Create shopify_sync_collections table
CREATE TABLE rag_system.shopify_sync_collections (
    id SERIAL PRIMARY KEY,
    collection_id BIGINT UNIQUE,
    title TEXT,
    handle TEXT,
    description TEXT,
    description_html TEXT,
    products_count INTEGER,
    products JSONB,
    rule_set JSONB,
    sort_order TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    template_suffix TEXT,
    updated_at TIMESTAMP WITH TIME ZONE,
    sync_date DATE NOT NULL
);

ALTER TABLE rag_system.shopify_sync_collections OWNER TO "default";

-- Create shopify_sync_blog_articles table
CREATE TABLE rag_system.shopify_sync_blog_articles (
    id SERIAL PRIMARY KEY,
    blog_id BIGINT,
    article_id BIGINT,
    blog_title TEXT,
    title TEXT,
    author TEXT,
    content TEXT,
    content_html TEXT,
    excerpt TEXT,
    handle TEXT,
    image JSONB,
    tags TEXT,
    seo JSONB,
    status TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    comments_count INTEGER,
    summary_html TEXT,
    template_suffix TEXT,
    sync_date DATE NOT NULL
);

ALTER TABLE rag_system.shopify_sync_blog_articles OWNER TO "default";

CREATE INDEX unique_blog_article_idx ON rag_system.shopify_sync_blog_articles(blog_id, article_id);

-- Create product_applications table in marketing schema
CREATE TABLE marketing.product_applications (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES rag_system.shopify_sync_products(id) ON DELETE CASCADE,
    application TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE marketing.product_applications OWNER TO "default";

CREATE INDEX idx_product_applications_product_id ON marketing.product_applications(product_id);

-- Create blog_posts table in marketing schema
CREATE TABLE marketing.blog_posts (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    product_id INTEGER REFERENCES rag_system.shopify_sync_products(id) ON DELETE SET NULL,
    application_id INTEGER REFERENCES marketing.product_applications(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE marketing.blog_posts OWNER TO "default";

CREATE INDEX idx_blog_posts_product_id ON marketing.blog_posts(product_id);
CREATE INDEX idx_blog_posts_application_id ON marketing.blog_posts(application_id);
CREATE INDEX idx_blog_posts_created_at ON marketing.blog_posts(created_at);

-- Add triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_shopify_sync_state_updated_at
    BEFORE UPDATE ON rag_system.shopify_sync_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blog_posts_updated_at
    BEFORE UPDATE ON marketing.blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 