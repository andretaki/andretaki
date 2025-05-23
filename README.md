# ChemFlow Marketing System

An AI-powered marketing system for chemical e-commerce businesses that generates educational content for chemical products using multi-agent AI.

## Features

- Product synchronization with Shopify
- AI-powered content generation:
  - Chemical applications discovery
  - Blog post generation
  - Video script creation
- Content scheduling and management
- Multi-platform video generation
- Activity logging and monitoring

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Shopify store
- OpenAI API key
- Google AI API key
- Video generation API keys (Synthesia, Runway, Pictory)

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/chemflow-marketing.git
   cd chemflow-marketing
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your API keys and configuration.

5. Set up the database:
   ```bash
   npm run db:generate  # Generate migrations
   npm run db:push     # Push migrations to database
   npm run db:setup    # Run initial setup
   ```

## Usage

### CLI Commands

- Sync products from Shopify:
  ```bash
  npm run sync:products
  ```

- Generate content:
  ```bash
  npm run generate:content
  ```

- Schedule content:
  ```bash
  npm run schedule:content
  ```

### Development

- Start the development server:
  ```bash
  npm run dev
  ```

- Build for production:
  ```bash
  npm run build
  ```

- Start production server:
  ```bash
  npm run start
  ```

## Architecture

The system uses a multi-agent architecture with specialized agents for different content generation tasks:

- Applications Agent: Discovers chemical applications
- Blog Outline Agent: Creates blog post outlines
- Blog Writer Agent: Writes full blog posts
- Video Script Agent: Creates video scripts
- Orchestrator: Coordinates all agents

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT
