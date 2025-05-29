# ChemFlow Marketing System

AI-powered chemical marketing automation system with integrated content generation, campaign management, and RAG-enhanced insights.

## 🚀 Features

### 🧪 **Chemical Product Management**
- Shopify integration for product sync (products, customers, orders, collections, blog articles)
- Chemical-specific metadata (CAS numbers, molecular formulas, safety data)
- Enriched product applications and use cases

### 🤖 **AI-Powered Content Generation**
- **Innovator Agent**: Generate blog ideas based on chemical products or themes
- **Blog Writing Agents**: Create outlines, sections, and complete articles
- **Video Content Agents**: Generate scripts and visual concepts
- **Safety Content Agent**: Specialized chemical safety content
- **Ad Campaign Generator**: Platform-specific advertising content

### 📊 **Marketing Dashboard**
- Real-time metrics and KPIs
- Task queue and pipeline management
- Campaign performance tracking
- Content generation status

### 🔍 **RAG (Retrieval-Augmented Generation)**
- Document ingestion and embedding
- Semantic search across chemical knowledge base
- Context-aware content generation

### 📋 **Content Pipeline**
- Structured workflow: Ideas → Outlines → Content → Publishing
- Task dependency management
- Status tracking and progress monitoring

## 🛠️ Installation

```bash
# Clone the repository
git clone <repository-url>
cd chemflow-marketing

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up the database
npm run db:generate
npm run db:migrate

# Run the development server
npm run dev
```

## 🔧 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/chemflow"

# OpenAI API
OPENAI_API_KEY="your-openai-api-key"

# Shopify (optional)
SHOPIFY_STORE_URL="your-store.myshopify.com"
SHOPIFY_ACCESS_TOKEN="your-access-token"

# Application
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

### Database Schema

The system uses PostgreSQL with three schemas:
- `public`: Core application tables
- `rag_system`: Document storage and embeddings
- `marketing`: Content pipeline and agent configurations

## 📚 Usage

### 🖥️ Web Dashboard

Access the web dashboard at `http://localhost:3000/dashboard`

Features:
- Overview metrics and KPIs
- Recent activity and task queue
- Campaign management
- Content pipeline visualization

### 💻 CLI Tool

The CLI provides command-line access to core functionality:

```bash
# Install CLI globally
npm install -g .

# Or use directly with npm
npm run cli -- <command>
```

#### Generate Blog Ideas

```bash
# Generate ideas for a general theme
chemflow innovate \
  --focusType general_theme \
  --focusValue "Sustainable chemistry practices" \
  --audience "R&D Chemists and Process Engineers" \
  --numIdeasPerApplication 3

# Generate ideas for a specific product
chemflow innovate \
  --focusType enriched_product_id \
  --focusValue "123" \
  --audience "Laboratory Managers" \
  --numIdeasPerApplication 2
```

#### Other CLI Commands

```bash
# Sync Shopify data
chemflow sync --source shopify --entity products

# Generate content
chemflow generate --type blog_outline --input 456

# Manage pipeline
chemflow pipeline --action list --status pending

# Configure agents
chemflow config --action get --name innovator
```

### 🤖 Agent System

#### Innovator Agent

Generates blog ideas based on:
- **Enriched Product Applications**: Ideas tailored to specific product use cases
- **General Themes**: Broad chemistry topics and trends

```typescript
import { runInnovatorAgent } from './src/lib/agents/innovator-agent';

const result = await runInnovatorAgent({
  focusType: 'enriched_product_id',
  focusValue: '123',
  targetAudience: 'R&D Chemists',
  numIdeasPerApplication: 2
});
```

#### Other Agents (Planned)

- **Blog Outline Agent**: Creates detailed article structures
- **Blog Writer Agent**: Generates complete articles
- **Video Strategy Agent**: Develops video content plans
- **Video Script Agent**: Creates video scripts
- **Safety Content Agent**: Specialized chemical safety content
- **Ad Campaign Agent**: Platform-specific advertising

## 📊 Database Schema

### Core Tables

```sql
-- Shopify sync data (rag_system schema)
shopify_sync_products     -- Product catalog
shopify_sync_customers    -- Customer data
shopify_sync_orders       -- Order history
shopify_sync_collections  -- Product collections
shopify_sync_blog_articles -- Existing blog content

-- Marketing pipeline (marketing schema)
content_pipeline          -- Task management
agent_configurations      -- AI agent settings
product_applications      -- Enriched product data
blog_posts               -- Generated content

-- RAG system (rag_system schema)
documents                -- Document storage
chunks                   -- Text chunks with embeddings
sync_state              -- Data sync tracking
```

### Content Pipeline States

- `blog_idea` → `blog_outline` → `blog_content` → `published`
- `video_concept` → `video_script` → `video_assets` → `video_complete`
- `ad_strategy` → `ad_copy` → `ad_assets` → `campaign_live`

## 🎯 Target Audiences

The system is designed for chemical industry marketing teams:

- **R&D Chemists**: Technical deep-dives and research applications
- **Process Engineers**: Manufacturing and optimization content  
- **Laboratory Managers**: Safety, compliance, and best practices
- **Procurement Specialists**: Product comparisons and sourcing guides
- **Quality Control**: Testing methodologies and standards

## 🔮 Roadmap

### Phase 1 (Current)
- ✅ Database schema and migrations
- ✅ Innovator Agent for blog ideas
- ✅ Web dashboard (basic)
- ✅ CLI tool foundation

### Phase 2 (Next)
- 🔄 Complete blog writing pipeline
- 🔄 RAG system integration
- 🔄 Shopify sync automation
- 🔄 Advanced dashboard analytics

### Phase 3 (Future)
- 🔄 Video content generation
- 🔄 Multi-platform ad campaigns
- 🔄 Performance analytics
- 🔄 A/B testing framework

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For questions, issues, or feature requests:
- Create an issue on GitHub
- Check the documentation
- Review example usage in `/scripts/test-innovator.ts`

## 🔄 Shopify Product Sync

The system includes comprehensive Shopify product synchronization capabilities to keep your chemical product data in sync with your Shopify store.

### Environment Setup

Ensure these environment variables are set in your `.env.local` (for development) or Vercel project settings (for production):

```bash
# Shopify Integration (required for sync)
SHOPIFY_SHOP_DOMAIN="your-shop.myshopify.com"
SHOPIFY_ACCESS_TOKEN="your-shopify-access-token"
```

### Basic Usage

```bash
# Sync all products (without metafields)
npm run cli sync --entity products

# Sync products with metafields (for chemical data)
npm run cli sync --entity products --metafields

# Full sync (ignoring previous sync state)
npm run cli sync --entity products --metafields --full

# Use custom metafield namespace
npm run cli sync --entity products --metafields --namespace "your_custom_namespace"

# Check sync status
npm run cli sync status
```

### Setting Up Chemical Metafields in Shopify

To store chemical-specific data, set up metafields in your Shopify Admin:

1. Go to **Settings** → **Custom data**
2. Add **Product** metafields with namespace `chemflow_custom`:
   - `cas_number` (Single line text)
   - `chemical_formula` (Single line text) 
   - `properties_json` (JSON)
   - `safety_info_json` (JSON)

### What Gets Synced

The sync process captures:
- **Basic Product Info**: Title, description, vendor, product type, handle, status, tags
- **Shopify Metadata**: Created/updated timestamps, published status
- **Product Structure**: Variants, options, images
- **Chemical Data**: CAS numbers, chemical formulas, properties, safety information (from metafields)

All synced data is stored in the `rag_system.shopify_sync_products` table for use by the marketing AI agents.

### Sync Status and Monitoring

```bash
# View sync status for all entities
npm run cli sync status

# View status for specific entity
npm run cli sync status --entity products
```

The system tracks:
- Last sync time and status
- Number of items processed
- Any errors encountered
- Total items processed over time

---

**ChemFlow** - Transforming chemical marketing with AI-powered automation 🧪✨
