// Trace: SPEC-rag-2, TASK-022
// Admin routes for embedding management

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { EmbeddingProcessor } from '../services/embedding-processor';
import { authMiddleware } from '../middleware/auth';

const admin = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all admin routes
admin.use('*', authMiddleware);

/**
 * POST /admin/reindex-all
 * Reindex all work notes into vector store
 * Used for initial setup or recovery
 */
admin.post('/reindex-all', async (c) => {
  const batchSize = parseInt(c.req.query('batchSize') || '10');

  const processor = new EmbeddingProcessor(c.env);
  const result = await processor.reindexAll(batchSize);

  return c.json({
    success: true,
    message: `벡터 스토어 재인덱싱 완료`,
    result,
  });
});

/**
 * POST /admin/reindex/:workId
 * Reindex a single work note into vector store
 */
admin.post('/reindex/:workId', async (c) => {
  const workId = c.req.param('workId');

  const processor = new EmbeddingProcessor(c.env);

  try {
    await processor.reindexOne(workId);

    return c.json({
      success: true,
      message: `업무 노트 ${workId} 재인덱싱 완료`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return c.json(
      {
        success: false,
        message: errorMessage,
      },
      404
    );
  }
});

/**
 * GET /admin/embedding-stats
 * Get embedding statistics (total, embedded, pending)
 */
admin.get('/embedding-stats', async (c) => {
  const processor = new EmbeddingProcessor(c.env);
  const stats = await processor.getEmbeddingStats();

  return c.json(stats);
});

/**
 * POST /admin/embed-pending
 * Embed only work notes that are not yet embedded
 * More efficient than reindex-all
 */
admin.post('/embed-pending', async (c) => {
  const batchSize = parseInt(c.req.query('batchSize') || '10');

  const processor = new EmbeddingProcessor(c.env);
  const result = await processor.embedPending(batchSize);

  return c.json({
    success: true,
    message: `미완료 노트 임베딩 완료`,
    result,
  });
});

export default admin;
