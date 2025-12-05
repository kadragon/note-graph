// Trace: TASK-001, TASK-009, TASK-LLM-IMPORT, TASK-039
/**
 * Cloudflare Workers environment bindings
 */
export interface Env {
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  AI_GATEWAY: Fetcher;
  ASSETS: Fetcher; // Static assets binding for serving frontend files
  R2_BUCKET: R2Bucket; // R2 storage for project files
  ENVIRONMENT: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  AI_GATEWAY_ID: string;
  OPENAI_MODEL_CHAT: string;
  OPENAI_MODEL_EMBEDDING: string;
  OPENAI_MODEL_LIGHTWEIGHT: string; // gpt-5-mini for simple tasks
  OPENAI_API_KEY: string;
  CF_AIG_AUTHORIZATION?: string;
}
