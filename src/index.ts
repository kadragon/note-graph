// Trace: SPEC-auth-1, TASK-001, TASK-003
/**
 * Note Graph - Main Worker Entry Point
 * Personal work note management system with AI-powered features
 */

import { Hono } from 'hono';
import type { AuthUser } from './types/auth';
import { AuthenticationError } from './types/auth';
import { authMiddleware } from './middleware/auth';
import { getMeHandler } from './handlers/auth';

// Environment bindings type definition
export interface Env {
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  PDF_QUEUE: Queue;
  PDF_TEMP_STORAGE: R2Bucket;
  AI_GATEWAY: Fetcher;
  ENVIRONMENT: string;
  AI_GATEWAY_ID: string;
  OPENAI_MODEL_CHAT: string;
  OPENAI_MODEL_EMBEDDING: string;
  OPENAI_API_KEY: string;
}

// Initialize Hono app with auth context
const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

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

// ============================================================================
// Authenticated Endpoints
// ============================================================================

// GET /me - Get current authenticated user
app.get('/me', authMiddleware, getMeHandler);

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
  console.error(`Application error: ${err instanceof Error ? err.stack || err : JSON.stringify(err)}`);

  // Handle authentication errors
  if (err instanceof AuthenticationError) {
    return c.json(
      {
        code: 'UNAUTHORIZED',
        message: err.message,
      },
      401
    );
  }

  // Avoid leaking internal error details to the client in non-dev environments.
  const isDevelopment = c.env.ENVIRONMENT === 'development';
  const message = isDevelopment && err instanceof Error ? err.message : 'An internal server error occurred.';
  return c.json(
    {
      code: 'INTERNAL_ERROR',
      message,
    },
    500
  );
});

export default app;
