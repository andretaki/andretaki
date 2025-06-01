import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, TaskType } from '@google/generative-ai';
import { sql } from 'drizzle-orm';

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_AI_API;
if (!GOOGLE_AI_API_KEY) {
  console.warn('GOOGLE_AI_API_KEY or GOOGLE_AI_API not set. Embedding generation will be unavailable and return zero vectors.');
}

let genAIInstance: GoogleGenerativeAI | null = null;
let embeddingModelInstance: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null;

const EMBEDDING_MODEL_NAME = "text-embedding-004";
export const EMBEDDING_DIMENSIONS = 768;

function getEmbeddingModel() {
  if (!GOOGLE_AI_API_KEY) {
    return null;
  }
  if (!genAIInstance) {
    genAIInstance = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);
  }
  if (!embeddingModelInstance) {
    embeddingModelInstance = genAIInstance.getGenerativeModel({ model: EMBEDDING_MODEL_NAME });
  }
  return embeddingModelInstance;
}

export async function generateGeminiEmbedding(text: string, taskType: TaskType = TaskType.RETRIEVAL_DOCUMENT): Promise<number[]> {
  const model = getEmbeddingModel();
  if (!model) {
    console.error("Embedding model could not be initialized (likely missing API key). Returning zero vector.");
    return Array(EMBEDDING_DIMENSIONS).fill(0);
  }

  if (!text || text.trim() === "") {
    console.warn("Attempted to generate embedding for empty or whitespace-only text. Returning zero vector.");
    return Array(EMBEDDING_DIMENSIONS).fill(0);
  }

  try {
    const result = await model.embedContent(
      {
        content: { parts: [{ text }], role: "user" },
        taskType: taskType,
      }
    );
    const embedding = result.embedding;
    if (embedding && embedding.values && embedding.values.length === EMBEDDING_DIMENSIONS) {
      return embedding.values;
    }
    console.warn(`Embedding generation returned unexpected structure or dimension for text: "${text.substring(0, 50)}". Expected ${EMBEDDING_DIMENSIONS} dims. Got:`, embedding?.values?.length);
    return Array(EMBEDDING_DIMENSIONS).fill(0);
  } catch (error) {
    console.error(`Error generating Gemini embedding for text: "${text.substring(0, 50)}..." with task type ${taskType}. Error:`, error);
    return Array(EMBEDDING_DIMENSIONS).fill(0);
  }
}

export async function findSimilarTopicsWithPgVector(
  dbClient: any,
  embedding: number[],
  threshold: number = 0.80,
  limit: number = 5,
  excludeId?: number
): Promise<Array<{ id: number; topicTitle: string; similarity: number }>> {
  if (!embedding || embedding.every(v => v === 0) || embedding.length !== EMBEDDING_DIMENSIONS) {
    console.warn("[findSimilarTopicsWithPgVector] Received zero, null, or incorrect dimension embedding. Skipping similarity search.");
    return [];
  }
  const vectorString = `[${embedding.join(',')}]`;

  let query = sql`
    SELECT id, topic_title as "topicTitle", 1 - (topic_embedding <=> ${vectorString}::vector(${sql.raw(EMBEDDING_DIMENSIONS.toString())})) AS similarity
    FROM marketing.proposed_topics
    WHERE topic_embedding IS NOT NULL AND 1 - (topic_embedding <=> ${vectorString}::vector(${sql.raw(EMBEDDING_DIMENSIONS.toString())})) > ${threshold}
  `;

  if (excludeId !== undefined) {
    query.append(sql` AND id != ${excludeId}`);
  }

  query.append(sql` ORDER BY similarity DESC LIMIT ${limit};`);

  try {
    const results = await dbClient.execute(query);
    return results.rows as Array<{ id: number; topicTitle: string; similarity: number }>;
  } catch (error) {
    console.error("[findSimilarTopicsWithPgVector] Error executing pgvector similarity search:", error);
    if (error instanceof Error && (error.message.includes("type \"vector\" does not exist") || error.message.includes("operator does not exist: vector <=> vector"))) {
        console.error("--------------------------------------------------------------------");
        console.error("PGVECTOR ERROR: Ensure the 'vector' extension is enabled in your PostgreSQL database (CREATE EXTENSION IF NOT EXISTS vector;)");
        console.error(`And that 'topic_embedding' column in 'marketing.proposed_topics' is of type vector(${EMBEDDING_DIMENSIONS}).`);
        console.error("--------------------------------------------------------------------");
    }
    return [];
  }
} 