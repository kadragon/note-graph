// Trace: SPEC-auth-1, SPEC-refactor-repository-di, TASK-001, TASK-003, TASK-004, TASK-015, TASK-022, TASK-REFACTOR-004
/**
 * Note Graph - Main Worker Entry Point
 * Personal work note management system with AI-powered features
 */

import { AuthenticationError } from '@shared/types/auth';
import { Hono } from 'hono';
import { getMeHandler } from './handlers/auth';
import { authMiddleware } from './middleware/auth';
import { repositoriesMiddleware } from './middleware/repositories';
import admin from './routes/admin';
import aiDraft from './routes/ai-draft';
import { authGoogle } from './routes/auth-google';
import { calendar } from './routes/calendar';
import departments from './routes/departments';
import meetingMinutes from './routes/meeting-minutes';
import pdf from './routes/pdf';
// Route imports
import persons from './routes/persons';

import rag from './routes/rag';
import search from './routes/search';
import statistics from './routes/statistics';
import taskCategories from './routes/task-categories';
import todos from './routes/todos';
import workNoteGroups from './routes/work-note-groups';
import workNotes from './routes/work-notes';
import type { AppContext } from './types/context';
import type { Env } from './types/env';
import { DomainError } from './types/errors';

// Re-export Env type for compatibility
export type { Env };

// Initialize Hono app with auth context
const app = new Hono<AppContext>();

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'note-graph',
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// API Routes (all under /api prefix)
// ============================================================================

// Create API router with /api base path
const api = new Hono<AppContext>().basePath('/api');

// Inject repositories for all API routes
api.use('*', repositoriesMiddleware);

// API info endpoint
api.get('/', (c) => {
  return c.json({
    name: 'Note Graph API',
    version: '0.1.0',
    description: 'Personal work note management system with AI-powered features',
    endpoints: {
      health: '/health',
      me: '/api/me',
      persons: '/api/persons',
      departments: '/api/departments',
      taskCategories: '/api/task-categories',
      workNoteGroups: '/api/work-note-groups',
      meetingMinutes: '/api/meeting-minutes',
      workNotes: '/api/work-notes',
      todos: '/api/todos',
      search: '/api/search',
      rag: '/api/rag',
      ai: '/api/ai',
      pdfJobs: '/api/pdf-jobs',
      admin: '/api/admin',
      aiGatewayLogs: '/api/admin/ai-gateway/logs',
      statistics: '/api/statistics',
      authGoogle: '/api/auth/google',
      calendar: '/api/calendar',
    },
  });
});

// GET /api/me - Get current authenticated user
api.get('/me', authMiddleware, getMeHandler);

// API Route Groups
api.route('/persons', persons);
api.route('/departments', departments);
api.route('/task-categories', taskCategories);
api.route('/work-note-groups', workNoteGroups);
api.route('/meeting-minutes', meetingMinutes);
api.route('/work-notes', workNotes);
api.route('/todos', todos);
api.route('/search', search);
api.route('/rag', rag);
api.route('/ai', aiDraft);
api.route('/pdf-jobs', pdf);
api.route('/admin', admin);
api.route('/statistics', statistics);
api.route('/auth/google', authGoogle);
api.route('/calendar', calendar);

// Mount API router to main app
app.route('/', api);

// 404 handler
app.notFound(async (c) => {
  const path = c.req.path;

  // Helper function to create JSON 404 response (DRY principle)
  const notFoundResponse = () =>
    c.json(
      {
        error: 'Not Found',
        message: `Route ${c.req.method} ${path} not found`,
      },
      404
    );

  // For API routes, return JSON 404 error
  if (path.startsWith('/api/') || path === '/health') {
    return notFoundResponse();
  }

  // For all other routes (SPA client-side routes), serve index.html
  // This enables browser refresh on routes like /rag, /work-notes, etc.
  try {
    const indexUrl = new URL('/index.html', c.req.url);
    const response = await c.env.ASSETS.fetch(indexUrl);

    // Validate that index.html was successfully retrieved
    if (!response.ok) {
      console.error(`Failed to fetch index.html: ${response.status} ${response.statusText}`);
      return notFoundResponse();
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    // Log error details to aid debugging
    console.error(
      `ASSETS fetch error: ${error instanceof Error ? error.stack || error.message : JSON.stringify(error)}`
    );
    return notFoundResponse();
  }
});

// Error handler
app.onError((err, c) => {
  console.error(
    `Application error: ${err instanceof Error ? err.stack || err.message : JSON.stringify(err)}`
  );

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
  const message =
    isDevelopment && err instanceof Error ? err.message : 'An internal server error occurred.';
  return c.json(
    {
      code: 'INTERNAL_ERROR',
      message,
    },
    500
  );
});

export default app;
