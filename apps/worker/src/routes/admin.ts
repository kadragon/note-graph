// Trace: SPEC-rag-2, SPEC-refactor-repository-di, TASK-022, TASK-069, TASK-REFACTOR-004
// Admin routes for embedding management

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { errorHandler } from '../middleware/error-handler';
import { getValidatedQuery, queryValidator } from '../middleware/validation-middleware';
import { adminBatchQuerySchema, adminEmbeddingFailuresQuerySchema } from '../schemas/admin';
import { aiGatewayLogsQuerySchema } from '../schemas/ai-gateway-logs';
import { CloudflareAIGatewayLogService } from '../services/cloudflare-ai-gateway-log-service';
import { EmbeddingProcessor } from '../services/embedding-processor';
import type { AppContext } from '../types/context';
import { NotFoundError } from '../types/errors';

const admin = new Hono<AppContext>();

// Apply auth middleware to all admin routes
admin.use('*', authMiddleware);
admin.use('*', errorHandler);

/**
 * POST /admin/reindex-all
 * Reindex all work notes into vector store
 * Used for initial setup or recovery
 */
admin.post('/reindex-all', queryValidator(adminBatchQuerySchema), async (c) => {
  const { batchSize } = getValidatedQuery<typeof adminBatchQuerySchema>(c);

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

  await processor.reindexOne(workId);

  return c.json({
    success: true,
    message: `업무 노트 ${workId} 재인덱싱 완료`,
  });
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
admin.post('/embed-pending', queryValidator(adminBatchQuerySchema), async (c) => {
  const { batchSize } = getValidatedQuery<typeof adminBatchQuerySchema>(c);

  const processor = new EmbeddingProcessor(c.env);
  const result = await processor.embedPending(batchSize);

  return c.json({
    success: true,
    message: `미완료 노트 임베딩 완료`,
    result,
  });
});

/**
 * GET /admin/embedding-failures
 * List all dead-letter embedding failures
 * Used for monitoring and debugging failed embeddings that exceeded max retry attempts
 */
admin.get('/embedding-failures', queryValidator(adminEmbeddingFailuresQuerySchema), async (c) => {
  const { limit, offset } = getValidatedQuery<typeof adminEmbeddingFailuresQuerySchema>(c);

  const repositories = c.get('repositories');
  const result = await repositories.embeddingRetryQueue.findDeadLetterItems(limit, offset);

  return c.json(result);
});

/**
 * GET /admin/ai-gateway/logs
 * List Cloudflare AI Gateway logs (metadata only)
 */
admin.get('/ai-gateway/logs', queryValidator(aiGatewayLogsQuerySchema), async (c) => {
  const query = getValidatedQuery<typeof aiGatewayLogsQuerySchema>(c);
  const service = new CloudflareAIGatewayLogService(c.env);
  const logs = await service.listLogs(query);
  return c.json(logs);
});

/**
 * POST /admin/embedding-failures/:id/retry
 * Manually retry a dead-letter embedding failure
 * Resets the item to pending status for automatic retry processing
 */
admin.post('/embedding-failures/:id/retry', async (c) => {
  const id = c.req.param('id');

  const repositories = c.get('repositories');

  // Verify item exists and is in dead-letter status
  const item = await repositories.embeddingRetryQueue.findById(id);

  if (!item) {
    throw new NotFoundError('임베딩 재시도 항목', id);
  }

  if (item.status !== 'dead_letter') {
    return c.json(
      {
        success: false,
        message: `항목이 dead_letter 상태가 아닙니다: ${item.status}`,
        status: item.status,
      },
      400
    );
  }

  // Reset to pending for retry
  const success = await repositories.embeddingRetryQueue.resetToPending(id);

  if (!success) {
    return c.json(
      {
        success: false,
        message: `항목 상태가 변경되었습니다. 다시 시도해주세요.`,
        status: item.status,
      },
      409
    );
  }

  return c.json({
    success: true,
    message: `재시도 대기 상태로 초기화됨`,
    status: 'pending',
  });
});

export default admin;
