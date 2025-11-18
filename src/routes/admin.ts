// Trace: SPEC-rag-2, TASK-022
// Admin routes for embedding retry queue management

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { EmbeddingRetryService } from '../services/embedding-retry-service';
import { authMiddleware } from '../middleware/auth';

const admin = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all admin routes
admin.use('*', authMiddleware);

/**
 * GET /admin/embedding-failures
 * List dead-letter embedding failures with pagination
 */
admin.get('/embedding-failures', async (c) => {
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  const retryService = new EmbeddingRetryService(c.env.DB);

  const [items, total] = await Promise.all([
    retryService.getDeadLetterItems(limit, offset),
    retryService.countDeadLetterItems(),
  ]);

  return c.json({
    items,
    total,
    limit,
    offset,
  });
});

/**
 * POST /admin/embedding-failures/:id/retry
 * Manually retry a dead-letter embedding failure
 */
admin.post('/embedding-failures/:id/retry', async (c) => {
  const retryId = c.req.param('id');

  const retryService = new EmbeddingRetryService(c.env.DB);

  // Check if retry item exists and is in dead-letter status
  const item = await retryService.getRetryItem(retryId);

  if (!item) {
    return c.json(
      {
        success: false,
        message: '재시도 항목을 찾을 수 없습니다.',
      },
      404
    );
  }

  if (item.status !== 'dead_letter') {
    return c.json(
      {
        success: false,
        message: '재시도는 dead_letter 상태인 항목만 가능합니다.',
        current_status: item.status,
      },
      400
    );
  }

  // Reset to pending for retry
  await retryService.retryDeadLetterItem(retryId);

  return c.json({
    success: true,
    message: '재시도가 예약되었습니다.',
    status: 'pending',
  });
});

/**
 * GET /admin/embedding-failures/:id
 * Get details of a specific embedding failure
 */
admin.get('/embedding-failures/:id', async (c) => {
  const retryId = c.req.param('id');

  const retryService = new EmbeddingRetryService(c.env.DB);
  const item = await retryService.getRetryItem(retryId);

  if (!item) {
    return c.json(
      {
        error: '재시도 항목을 찾을 수 없습니다.',
      },
      404
    );
  }

  return c.json(item);
});

/**
 * GET /admin/retry-queue/stats
 * Get statistics about the retry queue
 */
admin.get('/retry-queue/stats', async (c) => {
  // Get counts by status
  const statsQuery = await c.env.DB.prepare(
    `SELECT
       status,
       COUNT(*) as count
     FROM embedding_retry_queue
     GROUP BY status`
  ).all<{ status: string; count: number }>();

  const stats = {
    pending: 0,
    retrying: 0,
    dead_letter: 0,
  };

  for (const row of statsQuery.results || []) {
    if (row.status === 'pending') stats.pending = row.count;
    if (row.status === 'retrying') stats.retrying = row.count;
    if (row.status === 'dead_letter') stats.dead_letter = row.count;
  }

  return c.json({
    stats,
    total: stats.pending + stats.retrying + stats.dead_letter,
  });
});

export default admin;
