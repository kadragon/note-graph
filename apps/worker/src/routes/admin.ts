// Trace: SPEC-rag-2, SPEC-refactor-repository-di, TASK-022, TASK-069, TASK-REFACTOR-004
// Admin routes for embedding management

import { getValidatedQuery, queryValidator } from '../middleware/validation-middleware';
import { adminBatchQuerySchema } from '../schemas/admin';
import { aiGatewayLogsQuerySchema } from '../schemas/ai-gateway-logs';
import { CloudflareAIGatewayLogService } from '../services/cloudflare-ai-gateway-log-service';
import { EmbeddingProcessor } from '../services/embedding-processor';
import { createProtectedRouter } from './_shared/router-factory';

const admin = createProtectedRouter();

/**
 * POST /admin/reindex-all
 * Reindex all work notes into vector store
 * Used for initial setup or recovery
 */
admin.post('/reindex-all', queryValidator(adminBatchQuerySchema), async (c) => {
  const { batchSize } = getValidatedQuery<typeof adminBatchQuerySchema>(c);

  const processor = new EmbeddingProcessor(c.get('db'), c.env, c.get('settingService'));
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

  const processor = new EmbeddingProcessor(c.get('db'), c.env, c.get('settingService'));

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
  const processor = new EmbeddingProcessor(c.get('db'), c.env, c.get('settingService'));
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

  const processor = new EmbeddingProcessor(c.get('db'), c.env, c.get('settingService'));
  const [workNotes, meetings] = await Promise.all([
    processor.embedPending(batchSize),
    processor.embedPendingMeetings(batchSize),
  ]);

  return c.json({
    success: true,
    message: `미완료 임베딩 완료`,
    result: { workNotes, meetings },
  });
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

export default admin;
