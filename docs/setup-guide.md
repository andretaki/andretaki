# ChemFlow Marketing System Setup Guide

This guide will help you deploy and configure your ChemFlow marketing system on Vercel with automated pipeline processing.

## Prerequisites

- Node.js 18+ installed locally
- PostgreSQL database (recommend Neon, Supabase, or Vercel Postgres)
- OpenAI API account
- Vercel account

## Environment Variables

Create these environment variables in your Vercel project settings:

### Required Variables

```bash
# Database Configuration
DATABASE_URL="postgresql://username:password@host:port/database"

# OpenAI API Configuration  
OPENAI_API_KEY="sk-your-openai-api-key-here"

# Vercel Cron Job Security
CRON_SECRET="your-secure-random-string-here"
```

### Optional Variables

```bash
# Application Environment
NODE_ENV="production"

# Shopify Integration (if using)
SHOPIFY_SHOP_DOMAIN="your-shop.myshopify.com"
SHOPIFY_ACCESS_TOKEN="your-shopify-access-token"

# Email Notifications
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

## Step-by-Step Deployment

### 1. Database Setup

#### Option A: Neon (Recommended)
1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string
4. Add it as `DATABASE_URL` in Vercel

#### Option B: Supabase
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings > Database
4. Copy the connection string
5. Add it as `DATABASE_URL` in Vercel

#### Option C: Vercel Postgres
1. In your Vercel project dashboard
2. Go to Storage tab
3. Create a Postgres database
4. Connection string will be auto-added

### 2. OpenAI API Setup

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Add it as `OPENAI_API_KEY` in Vercel
4. Ensure you have sufficient credits/billing set up

### 3. Vercel Deployment

#### Method A: GitHub Integration (Recommended)
1. Push your code to GitHub
2. Connect your GitHub repo to Vercel
3. Vercel will auto-deploy on push

#### Method B: Vercel CLI
```bash
npm install -g vercel
vercel login
vercel --prod
```

### 4. Environment Configuration

In your Vercel project dashboard:

1. Go to **Settings** > **Environment Variables**
2. Add all required variables:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `CRON_SECRET`: Generate a secure random string (use `openssl rand -base64 32`)

### 5. Database Migration

After deployment, run the database migration:

```bash
# If using Drizzle migrations
npm run db:push

# Or if you have custom migration scripts
npm run migrate
```

### 6. Verify Cron Job Setup

1. In Vercel dashboard, go to **Functions** tab
2. You should see the cron function listed
3. Check **Logs** to verify it's running every 10 minutes
4. Test manually using the API endpoint: `POST /api/pipeline/trigger`

## Local Development Setup

### 1. Clone and Install
```bash
git clone <your-repo>
cd chemflow-marketing
npm install
```

### 2. Environment Setup
Create `.env.local`:
```bash
DATABASE_URL="your-local-postgres-url"
OPENAI_API_KEY="your-openai-key"
CRON_SECRET="dev-secret"
```

### 3. Database Setup
```bash
# Start PostgreSQL locally or use cloud database
npm run db:push
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Test CLI Commands
```bash
# Check pipeline status
npm run cli pipeline status

# Test content generation
npm run cli innovate --focus-type="general_theme" --focus-value="Chemical Safety"

# View enrichment status
npm run cli pipeline enrichment
```

## Testing the System

### 1. Manual Pipeline Trigger
```bash
curl -X POST https://your-app.vercel.app/api/pipeline/trigger
```

### 2. Check Pipeline Status
```bash
curl https://your-app.vercel.app/api/pipeline/status
```

### 3. Content Generator Interface
Visit: `https://your-app.vercel.app/content-generator`

### 4. Dashboard
Visit: `https://your-app.vercel.app/dashboard`

## Troubleshooting

### Common Issues

**1. Cron Job Not Running**
- Check `CRON_SECRET` is set correctly
- Verify the cron function appears in Vercel Functions tab
- Check function logs for errors

**2. Database Connection Errors**
- Verify `DATABASE_URL` format is correct
- Check database server is accessible
- Ensure SSL is configured if required

**3. OpenAI API Errors**
- Verify `OPENAI_API_KEY` is valid
- Check API usage limits and billing
- Monitor rate limits

**4. Styling Issues**
- Clear browser cache
- Check Tailwind CSS is processing correctly
- Verify all dependencies are installed

### Debug Commands

```bash
# Check database connection
npm run cli config test-db

# Test agent functionality
npm run cli innovate --help

# View recent pipeline tasks
npm run cli pipeline show-tasks --limit=10

# Check pipeline status
npm run cli pipeline status
```

## Monitoring and Maintenance

### 1. Logs Monitoring
- Check Vercel function logs regularly
- Set up error alerting if needed
- Monitor database performance

### 2. Pipeline Health
- Use `/api/pipeline/status` to monitor task queues
- Check for failed tasks regularly
- Monitor content generation success rates

### 3. Resource Usage
- Monitor OpenAI API usage and costs
- Check database storage growth
- Monitor Vercel function execution time

### 4. Performance Optimization
- Adjust cron frequency in `vercel.json` if needed
- Optimize batch sizes in pipeline processing
- Consider adding caching for frequently accessed data

## Next Steps

1. **Content Review**: Set up a content review process for generated materials
2. **SEO Integration**: Add SEO optimization to generated content
3. **Analytics**: Implement content performance tracking
4. **Webhooks**: Add webhook endpoints for external integrations
5. **User Management**: Add authentication and user roles
6. **Backup Strategy**: Set up database backups and disaster recovery

## Support

- Check the logs in Vercel dashboard for errors
- Use CLI commands to debug pipeline issues
- Monitor API status endpoints for system health
- Review documentation in `/docs` folder for detailed API information 