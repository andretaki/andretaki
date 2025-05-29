# Pipeline Automation with Vercel Cron Jobs

This document describes how to set up and use the automated content pipeline using Vercel Cron Jobs.

## Overview

The pipeline automation system processes content creation in stages:

1. **Product Enrichment**: Analyzes Shopify products and creates application data
2. **Blog Idea Generation**: Uses the Innovator Agent to create blog ideas from enriched products  
3. **Outline Creation**: Converts blog ideas into structured outlines
4. **Section Content**: Generates content for each outline section
5. **Draft Assembly**: Combines sections into final blog posts

## Setup Instructions

### 1. Environment Variables

Add these variables to your Vercel project settings:

```bash
# Required for cron job security
CRON_SECRET=your-secure-random-string

# Database connection (already configured)
DATABASE_URL=your-postgres-connection-string

# OpenAI API key (for agents)
OPENAI_API_KEY=your-openai-api-key
```

### 2. Vercel Configuration

The `vercel.json` file configures the cron job to run every 10 minutes:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-pipeline",
      "schedule": "*/10 * * * *"
    }
  ],
  "functions": {
    "src/app/api/cron/process-pipeline/route.ts": {
      "maxDuration": 60
    }
  }
}
```

### 3. Deployment

Deploy your application to Vercel:

```bash
npm run build
vercel --prod
```

The cron job will automatically start running after deployment.

## API Endpoints

### Cron Processor
- **Path**: `/api/cron/process-pipeline`
- **Method**: POST
- **Auth**: Bearer token (CRON_SECRET)
- **Purpose**: Main pipeline processing (called by Vercel Cron)

### Manual Trigger
- **Path**: `/api/pipeline/trigger`
- **Method**: POST
- **Purpose**: Manually trigger pipeline processing for testing

### Pipeline Status
- **Path**: `/api/pipeline/status`
- **Method**: GET
- **Purpose**: Monitor pipeline health and task statistics

## Usage Examples

### Check Pipeline Status

```bash
curl https://your-app.vercel.app/api/pipeline/status
```

Response:
```json
{
  "success": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "pipeline": {
    "health": {
      "totalTasks": 45,
      "pendingTasks": 12,
      "completedTasks": 30,
      "failedTasks": 2,
      "inProgressTasks": 1
    },
    "tasksByType": {
      "blog_idea": { "pending": 3, "completed": 8 },
      "blog_outline": { "pending": 2, "completed": 5 },
      "blog_section_content": { "pending": 7, "completed": 15 }
    },
    "enrichment": {
      "totalProducts": 100,
      "enrichedProducts": 85,
      "enrichmentRate": 85
    }
  }
}
```

### Manual Pipeline Trigger

```bash
curl -X POST https://your-app.vercel.app/api/pipeline/trigger
```

### Using CLI (Local Development)

```bash
# Trigger pipeline processing
npm run cli pipeline trigger

# Check pipeline status
npm run cli pipeline status

# Generate ideas for a specific product
npm run cli innovate --focus-type="product_id" --focus-value="123"
```

## Pipeline Stages Explained

### Stage 0: Product Enrichment
- Finds Shopify products without enrichment data
- Creates application records with market potential and technical complexity
- Limits: 5 products per run

### Stage 1: Blog Idea Generation  
- Identifies enriched products without blog ideas
- Calls Innovator Agent to generate content ideas
- Limits: 3 products per run

### Stage 2: Outline Creation
- Processes pending blog ideas
- Creates structured outlines with 5 standard sections
- Limits: 3 ideas per run

### Stage 3: Section Content Generation
- Generates content for individual outline sections
- Uses mock content templates (replace with Scribe Agent)
- Limits: 5 sections per run

### Stage 4: Draft Assembly
- Checks when all sections for an outline are complete
- Creates assembly tasks for final blog creation
- Limits: 2 assemblies per run

## Monitoring and Troubleshooting

### View Logs

In Vercel dashboard:
1. Go to your project
2. Click "Functions" tab
3. Find the cron function executions
4. View logs for each run

### Common Issues

**Cron job not running:**
- Check Vercel project settings for cron configuration
- Verify CRON_SECRET is set correctly
- Check function timeout limits

**Database connection errors:**
- Verify DATABASE_URL is correct
- Check database server status
- Review connection pool limits

**Agent failures:**
- Check OPENAI_API_KEY is valid
- Review API rate limits
- Monitor token usage

### Manual Debugging

Test individual components:

```bash
# Test database connection
npm run cli config test-db

# Test agent functionality  
npm run cli innovate --help

# View recent pipeline tasks
npm run cli pipeline show-tasks --limit=10
```

## Configuration Options

### Cron Schedule

Modify the schedule in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-pipeline",
      "schedule": "0 */6 * * *"  // Every 6 hours
    }
  ]
}
```

Common schedules:
- `*/10 * * * *` - Every 10 minutes
- `0 * * * *` - Every hour
- `0 */6 * * *` - Every 6 hours
- `0 9 * * *` - Daily at 9 AM

### Processing Limits

Adjust batch sizes in the cron handler:

```typescript
// Reduce for lower API usage
const productsNeedingEnrichment = await db.query.shopifySyncProducts.findMany({
  // ... other options
  limit: 2  // Process fewer products per run
});
```

### Function Timeout

Increase timeout for larger batches:

```json
{
  "functions": {
    "src/app/api/cron/process-pipeline/route.ts": {
      "maxDuration": 120  // 2 minutes
    }
  }
}
```

## Security Considerations

1. **CRON_SECRET**: Use a strong, randomly generated secret
2. **API Rate Limits**: Monitor OpenAI API usage
3. **Database Limits**: Ensure connection pool can handle concurrent requests
4. **Function Timeout**: Set appropriate limits to prevent runaway processes

## Performance Tips

1. **Batch Processing**: Process items in small batches to avoid timeouts
2. **Error Handling**: Implement retry logic for transient failures
3. **Monitoring**: Set up alerts for failed cron jobs
4. **Resource Limits**: Monitor memory and CPU usage

## Next Steps

1. Replace mock content generation with actual AI agents
2. Add email notifications for pipeline failures
3. Implement retry logic for failed tasks
4. Add metrics and analytics dashboard
5. Create webhook endpoints for external triggers 