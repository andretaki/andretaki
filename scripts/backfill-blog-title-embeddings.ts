import 'dotenv/config';
import { db } from '../src/lib/db';
import { blogPosts } from '../src/lib/db/schema';
import { generateGeminiEmbedding } from '../src/lib/ai/embedding-client';
import { eq, isNull } from 'drizzle-orm';
import { TaskType } from '@google/generative-ai';

async function backfillEmbeddings() {
  console.log('Starting backfill of blog post title embeddings...');
  const postsToUpdate = await db.select({ id: blogPosts.id, title: blogPosts.title })
                              .from(blogPosts)
                              .where(isNull(blogPosts.title_embedding));
  
  console.log(`Found ${postsToUpdate.length} blog posts needing title embeddings.`);

  for (let i = 0; i < postsToUpdate.length; i++) {
    const post = postsToUpdate[i];
    if (!post.title) {
      console.warn(`Skipping post ID ${post.id} due to null title.`);
      continue;
    }
    try {
      console.log(`Generating embedding for post ID ${post.id}: "${post.title.substring(0,50)}..." (${i+1}/${postsToUpdate.length})`);
      const embedding = await generateGeminiEmbedding(post.title, TaskType.SEMANTIC_SIMILARITY);
      await db.update(blogPosts)
              .set({ title_embedding: embedding })
              .where(eq(blogPosts.id, post.id));
      // Add a small delay to avoid overwhelming API or DB
      if ((i + 1) % 10 === 0) await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to generate/update embedding for post ID ${post.id}:`, error);
    }
  }
  console.log('Backfill complete.');
  process.exit(0);
}

backfillEmbeddings().catch(console.error); 