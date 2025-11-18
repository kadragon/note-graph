// Trace: SPEC-auth-1, TASK-001, TASK-003, TASK-004
/**
 * Note Graph - Main Worker Entry Point
 * Personal work note management system with AI-powered features
 */

import { Hono } from 'hono';
import type { AuthUser } from './types/auth';
import { AuthenticationError } from './types/auth';
import { DomainError } from './types/errors';
import type { Env } from './types/env';
import { authMiddleware } from './middleware/auth';
import { getMeHandler } from './handlers/auth';

// Route imports
import persons from './routes/persons';
import departments from './routes/departments';
import workNotes from './routes/work-notes';
import todos from './routes/todos';
import search from './routes/search';

// Re-export Env type for compatibility
export type { Env };

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

// ============================================================================
// API Route Groups
// ============================================================================

app.route('/persons', persons);
app.route('/departments', departments);
app.route('/work-notes', workNotes);
app.route('/todos', todos);
app.route('/search', search);

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

  // Handle domain errors (ValidationError, NotFoundError, etc.)
  if (err instanceof DomainError) {
    const response: { code: string; message: string; details?: unknown } = {
      code: err.code,
      message: err.message,
    };
    if (err.details) {
      response.details = err.details;
    }
    return c.json(response, err.statusCode as 400 | 404 | 409 | 429 | 500);
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
