// Trace: SPEC-auth-1, TASK-001
/**
 * Note Graph - Main Worker Entry Point
 * Personal work note management system with AI-powered features
 */

import { Hono } from 'hono';

// Environment bindings type definition
export interface Env {
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  PDF_QUEUE: Queue;
  PDF_TEMP_STORAGE: R2Bucket;
  AI_GATEWAY: any;
  ENVIRONMENT: string;
  AI_GATEWAY_ID: string;
  OPENAI_MODEL_CHAT: string;
  OPENAI_MODEL_EMBEDDING: string;
  OPENAI_API_KEY: string;
}

// Initialize Hono app
const app = new Hono<{ Bindings: Env }>();

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'note-graph',
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Note Graph API',
    version: '0.1.0',
    description: 'Personal work note management system with AI-powered features',
    endpoints: {
      health: '/health',
      me: '/me',
      docs: '/openapi.yaml',
    },
  });
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      message: `Route ${c.req.method} ${c.req.path} not found`,
    },
    404
  );
});

// Error handler
app.onError((err, c) => {
  console.error('Application error:', err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: err.message,
    },
    500
  );
});

export default app;
