// Trace: TASK-001, TASK-009
/**
 * Cloudflare Workers environment bindings
 */
export interface Env {
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  AI_GATEWAY: Fetcher;
  ENVIRONMENT: string;
  AI_GATEWAY_ID: string;
  OPENAI_MODEL_CHAT: string;
  OPENAI_MODEL_EMBEDDING: string;
  OPENAI_API_KEY: string;
  CF_AIG_AUTHORIZATION?: string;
}
