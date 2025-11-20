// Trace: SPEC-auth-1, TASK-001, TASK-003, TASK-004, TASK-015
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
import taskCategories from './routes/task-categories';
import workNotes from './routes/work-notes';
import todos from './routes/todos';
import search from './routes/search';
import rag from './routes/rag';
import aiDraft from './routes/ai-draft';
import pdf from './routes/pdf';
import admin from './routes/admin';

// Re-export Env type for compatibility
export type { Env };

// Initialize Hono app with auth context
const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// ============================================================================
// SPA Fallback Middleware
// ============================================================================
// When browser navigates directly to SPA routes (e.g., /work-notes) and refreshes,
// we need to serve index.html instead of the API response.
// This mimics the behavior of Vite's proxy bypass in development.

// Frontend SPA routes that overlap with API routes
const spaRoutes = [
  '/work-notes',
  '/persons',
  '/departments',
  '/task-categories',
  '/search',
  '/rag',
  '/pdf',
];

app.use('*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  const accept = c.req.header('accept') || '';

  // Check if request is for an SPA route and browser is requesting HTML
  const isSpaRoute = spaRoutes.some(
    (route) => path === route || path.startsWith(route + '/')
  );
  const wantsHtml = accept.includes('text/html');

  if (isSpaRoute && wantsHtml) {
    // Serve index.html for SPA client-side routing
    try {
      const indexUrl = new URL('/index.html', c.req.url);
      // Return response directly for better efficiency (avoids unnecessary object creation)
      return c.env.ASSETS.fetch(indexUrl);
    } catch (error) {
      console.error('Failed to serve index.html:', error);
      // Fall through to normal routing if assets fetch fails
      return next();
    }
  }

  return next();
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'note-graph',
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
  });
});

// API info endpoint
app.get('/api', (c) => {
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
app.route('/task-categories', taskCategories);
app.route('/work-notes', workNotes);
app.route('/todos', todos);
app.route('/search', search);
app.route('/rag', rag);
app.route('/ai', aiDraft);
app.route('/pdf-jobs', pdf);
app.route('/admin', admin);

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
  console.error(`Application error: ${err instanceof Error ? err.stack || err.message : JSON.stringify(err)}`);

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
