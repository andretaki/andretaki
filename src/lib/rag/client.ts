import { z } from 'zod';

// --- Data Structures for RAG Responses ---
// These should mirror what your RAG system's API would return.

export const RagChunkSchema = z.object({
  id: z.union([z.string(), z.number()]), // Chunk ID can be string or number
  document_id: z.union([z.string(), z.number()]),
  content: z.string(),
  score: z.number().optional(), // Relevance score from retrieval
  metadata: z.record(z.unknown()).optional(), // Original metadata from the chunk
  source_document_name: z.string().optional(),
  source_document_url: z.string().optional(),
  // Add any other fields your RAG API returns per chunk
});
export type RagChunk = z.infer<typeof RagChunkSchema>;

export const RagQueryResultSchema = z.object({
  query: z.string(),
  results: z.array(RagChunkSchema),
  summary: z.string().optional(), // If your RAG API provides a summary
});
export type RagQueryResult = z.infer<typeof RagQueryResultSchema>;

// --- RAG Service Client Interface ---

export interface RagQueryFilters {
  source_type?: string[] | string;
  document_id?: string[] | string;
  product_id?: string[] | string; // Assuming product_id is available in chunk metadata
  customer_id?: string[] | string; // Assuming customer_id is available (PII-scrubbed context)
  date_from?: string; // ISO Date string
  date_to?: string; // ISO Date string
  // Add other potential filter keys based on your RAG chunk metadata
  [key: string]: any; // Allow arbitrary filter keys
}

interface RagClientOptions {
  apiUrl: string;
  apiKey?: string;
}

export class RagClient {
  private apiUrl: string;
  private apiKey?: string;

  constructor(options: RagClientOptions) {
    this.apiUrl = options.apiUrl;
    this.apiKey = options.apiKey;

    if (!this.apiUrl) {
      console.warn("RAG_API_URL is not set. RagClient will not be able to make requests.");
      // Avoid throwing an error here if the app needs to run without RAG for some features
    }
  }

  private async fetchFromRagApi<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'POST',
    body?: Record<string, unknown>
  ): Promise<T> {
    if (!this.apiUrl) {
        throw new Error("RagClient cannot make requests: RAG_API_URL is not configured.");
    }
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const url = `${this.apiUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
    
    console.info(`[RagClient] Querying RAG API: ${method} ${url}`, body ? `Body (partial): ${JSON.stringify(body).substring(0, 200)}...` : '');

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[RagClient] RAG API Error (${response.status} from ${url}): ${errorText}`);
        throw new Error(`RAG API request to ${url} failed with status ${response.status}: ${errorText.substring(0, 200)}`);
      }
      return await response.json() as T;
    } catch (error) {
      console.error(`[RagClient] Network or parsing error fetching from RAG API (${url}):`, error);
      throw error; // Re-throw to be handled by agent's retry
    }
  }

  /**
   * Performs a semantic search query against the RAG system.
   */
  async search(
    queryText: string,
    topK: number = 3,
    filters?: RagQueryFilters
  ): Promise<RagQueryResult> {
    const payload = {
      query: queryText,
      top_k: topK,
      filters: filters || {},
    };
    // Assuming your RAG API returns an object with a 'results' array and optionally a 'query' and 'summary'
    const rawResponse = await this.fetchFromRagApi<{ query?: string; results: any[]; summary?: string }>('search', 'POST', payload);
    
    try {
      const validatedResults = z.array(RagChunkSchema.passthrough()).parse(rawResponse.results);
      return {
        query: rawResponse.query || queryText, // Use original query if API doesn't return it
        results: validatedResults as RagChunk[],
        summary: rawResponse.summary,
      };
    } catch (validationError) {
      console.error("[RagClient] RAG search result validation error:", validationError);
      console.error("[RagClient] Received raw results for validation:", rawResponse.results);
      // Return empty results or rethrow, depending on desired strictness
      return { query: queryText, results: [], summary: "Error validating RAG results."};
    }
  }

  /**
   * Retrieves specific document details (if your RAG API supports this).
   */
  async getDocument(documentId: string): Promise<any | null> { // Define a proper Document schema if needed
    try {
      return await this.fetchFromRagApi<any | null>(`documents/${documentId}`, 'GET');
    } catch (error) {
      console.warn(`Could not fetch document ${documentId} from RAG: ${error}`);
      return null;
    }
  }

  /**
   * Summarizes content from RAG based on a query or document IDs.
   */
  async summarize(
    queryText?: string,
    documentIds?: string[],
    chunkIds?: string[],
    maxLength: number = 250 // Max length of summary in words
  ): Promise<string | null> {
    if (!queryText && !documentIds?.length && !chunkIds?.length) {
      throw new Error("Either queryText, documentIds, or chunkIds must be provided for summarization.");
    }
    const payload = {
      query: queryText,
      document_ids: documentIds,
      chunk_ids: chunkIds,
      max_length: maxLength,
    };
    const result = await this.fetchFromRagApi<{ summary: string }>('summarize', 'POST', payload);
    return result.summary;
  }

  async summarizeContent(
    contentToSummarize: string,
    maxLength: number = 150, // words
    context?: string // Optional context for better summarization
  ): Promise<string | null> {
    if (!contentToSummarize) return null;
    // This method would ideally call a /summarize endpoint on your RAG API
    // If your RAG API doesn't have one, you might call an LLM directly here for summarization
    // For now, let's assume a direct LLM call for summarization (could be OpenAI or Gemini)
    
    // Placeholder - replace with actual LLM call (e.g., using this.openai from BaseAgent if RagClient extends it, or a separate client)
    console.warn("[RagClient] summarizeContent is using a placeholder LLM call. Implement with your actual summarization logic/API.");
    const prompt = `Summarize the following text${context ? ` in the context of "${context}"` : ''} into approximately ${maxLength} words or less. Focus on key actionable insights:\n\nTEXT:\n${contentToSummarize}`;
    // const summary = await makeOpenAICall(prompt); // Example
    // return summary;
    return `Placeholder summary for content starting with: ${contentToSummarize.substring(0,50)}...`;
  }
}

// Initialize client (ensure RAG_API_URL is in .env)
let ragApiClient: RagClient;
try {
    ragApiClient = new RagClient({
        apiUrl: process.env.RAG_API_URL!,
        apiKey: process.env.RAG_API_KEY,
    });
} catch (e) {
    console.error("Failed to initialize RagClient. RAG features will be unavailable.", e)
    // Create a dummy client or handle appropriately so the app doesn't crash if RAG_API_URL is missing
    ragApiClient = {
        search: async () => ({ query: '', results: [], summary: 'RAG Client not configured.'}),
        summarizeContent: async () => 'RAG Client not configured.'
    } as unknown as RagClient; // Type assertion for dummy
}

export { ragApiClient }; 