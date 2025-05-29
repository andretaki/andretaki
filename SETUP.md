# ChemFlow Marketing System Setup Guide

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env.local` file in the root directory with the following configuration:

```bash
# Database Configuration (Required)
DATABASE_URL="postgresql://username:password@localhost:5432/chemflow_marketing"

# OpenAI API Configuration (Required for AI agents)
OPENAI_API_KEY="sk-your-openai-api-key-here"

# Shopify Integration (Required for sync functionality)
SHOPIFY_SHOP_DOMAIN="your-shop.myshopify.com"
SHOPIFY_ACCESS_TOKEN="shppa_your-shopify-access-token"

# Application Configuration
NODE_ENV="development"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

### 2. Installation

```bash
# Install dependencies
npm install

# Set up database
npm run db:generate
npm run db:migrate

# Start development server
npm run dev
```

### 3. Available Pages

Once running, you can access these pages:

- **Home**: `http://localhost:3000/` - Navigation and quick start
- **Dashboard**: `http://localhost:3000/dashboard` - Metrics and pipeline status
- **Content Generator**: `http://localhost:3000/content-generator` - AI content creation
- **API Status**: `http://localhost:3000/api/pipeline/status` - Pipeline API

⚠️ **Important**: The content generator is at `/content-generator`, not `/content`

## 🔄 Shopify Sync Setup

### 1. Get Shopify Credentials

1. Go to your Shopify Admin
2. Navigate to **Apps** → **App and sales channel settings**
3. Click **Develop apps for your store**
4. Create a private app with these permissions:
   - `read_products`
   - `read_product_listings`
   - `read_inventory`
   - `read_customers` (optional)
   - `read_orders` (optional)

### 2. Set Up Chemical Metafields

In Shopify Admin:
1. Go to **Settings** → **Custom data**
2. Add **Product** metafields with namespace `chemflow_custom`:
   - `cas_number` (Single line text)
   - `chemical_formula` (Single line text)
   - `properties_json` (JSON)
   - `safety_info_json` (JSON)

### 3. Run Your First Sync

```bash
# Basic product sync
npm run cli sync --entity products

# Sync with chemical metafields
npm run cli sync --entity products --metafields

# Check sync status
npm run cli sync status
```

## 🤖 Using the AI Agents

### Content Generator Web Interface

Visit `http://localhost:3000/content-generator` to:
- Generate blog content ideas and outlines
- Create video scripts and concepts
- Generate safety documentation

### CLI Commands

```bash
# Generate blog ideas
npm run cli innovate --focusType general_theme --focusValue "Green Chemistry"

# Check pipeline status
npm run cli pipeline status

# View available commands
npm run cli --help
```

## 📊 Database Schema

The system uses three PostgreSQL schemas:

- **`public`**: Core application tables
- **`rag_system`**: Document storage, embeddings, and Shopify sync data
- **`marketing`**: Content pipeline and agent configurations

## 🔧 Troubleshooting

### 404 Errors

If you're getting 404 errors:
- Ensure you're using the correct URLs (see "Available Pages" above)
- Check that the development server is running (`npm run dev`)
- Verify your Next.js app is building successfully

### Shopify Sync Issues

- Verify `SHOPIFY_SHOP_DOMAIN` and `SHOPIFY_ACCESS_TOKEN` are set correctly
- Check that your Shopify app has the required permissions
- Test API connectivity: the CLI will show helpful error messages

### Database Connection Issues

- Ensure PostgreSQL is running
- Verify `DATABASE_URL` format: `postgresql://user:pass@host:port/db`
- Run `npm run db:migrate` to ensure tables are created

## 📚 Next Steps

1. **Sync Your Products**: Start with `npm run cli sync --entity products --metafields`
2. **Explore the Dashboard**: Visit `/dashboard` to see your data
3. **Generate Content**: Use `/content-generator` to create marketing materials
4. **Set Up Automation**: Configure the pipeline for automated content generation

## 🆘 Getting Help

- Check the console for error messages
- Review the logs in your terminal
- Ensure all environment variables are properly set
- Verify database connectivity and migrations 