import * as databaseFactory from '@worker/adapters/database-factory';
import worker from '@worker/index';
import { EMBEDDING_FAILURE_REASON, EmbeddingProcessor } from '@worker/services/embedding-processor';
import { SettingService } from '@worker/services/setting-service';
import type { DatabaseClient } from '@worker/types/database';
import type { Env } from '@worker/types/env';
import { afterEach, describe, expect, it, vi } from 'vitest';

function createMockHyperdrive(): Env['HYPERDRIVE'] {
  return {
    connectionString: 'postgresql://user:pass@host:5432/db',
    host: 'host',
    port: 5432,
    user: 'user',
    password: 'pass',
    database: 'db',
  } as unknown as Env['HYPERDRIVE'];
}

function createMockDatabaseClient(): DatabaseClient {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    queryOne: vi.fn().mockResolvedValue(null),
    execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
    transaction: vi.fn(),
    executeBatch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

describe('Worker scheduled handler', () => {
  it('runs embedPending through waitUntil', async () => {
    const waitUntil = vi.fn();
    const ctx = { waitUntil } as unknown as ExecutionContext;
    const dbMock = createMockDatabaseClient();
    vi.spyOn(databaseFactory, 'createDatabaseClient').mockReturnValue(dbMock);
    vi.spyOn(SettingService.prototype, 'preload').mockResolvedValue();
    const embedPendingSpy = vi
      .spyOn(EmbeddingProcessor.prototype, 'embedPending')
      .mockResolvedValue({
        total: 1,
        processed: 1,
        succeeded: 1,
        failed: 0,
        errors: [],
      });
    const env = {
      HYPERDRIVE: createMockHyperdrive(),
      VECTORIZE: { upsert: vi.fn(), query: vi.fn(), deleteByIds: vi.fn() },
      OPENAI_MODEL_EMBEDDING: 'text-embedding-3-small',
      OPENAI_API_KEY: 'test',
      AI_GATEWAY_BASE_URL: 'https://gateway.test',
      AI_GATEWAY_ID: 'test',
      OPENAI_MODEL_CHAT: 'gpt-5.2',
      OPENAI_MODEL_LIGHTWEIGHT: 'gpt-5-mini',
      ENVIRONMENT: 'test',
      ASSETS: {} as Env['ASSETS'],
      AI_GATEWAY: {} as Env['AI_GATEWAY'],
      R2_BUCKET: {} as Env['R2_BUCKET'],
      CLOUDFLARE_ACCOUNT_ID: 'test-account',
      GOOGLE_CLIENT_ID: 'test-client',
      GOOGLE_CLIENT_SECRET: 'test-secret',
      GOOGLE_REDIRECT_URI: 'https://example.test/callback',
      GDRIVE_ROOT_FOLDER_ID: 'test-root',
    } as unknown as Env;
    const controller = {
      cron: '*/5 * * * *',
      scheduledTime: Date.now(),
    } as ScheduledController;

    (
      worker as unknown as {
        scheduled: (controller: ScheduledController, env: Env, ctx: ExecutionContext) => void;
      }
    ).scheduled(controller, env, ctx);

    expect(waitUntil).toHaveBeenCalledTimes(1);

    const scheduledPromise = waitUntil.mock.calls[0]?.[0] as Promise<void>;
    await scheduledPromise;

    expect(embedPendingSpy).toHaveBeenCalledWith(5);
    expect(dbMock.close).toHaveBeenCalled();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('counts scheduled skip reasons from error reason codes', async () => {
    const waitUntil = vi.fn();
    const ctx = { waitUntil } as unknown as ExecutionContext;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(SettingService.prototype, 'preload').mockResolvedValue();
    const embedPendingSpy = vi
      .spyOn(EmbeddingProcessor.prototype, 'embedPending')
      .mockResolvedValue({
        total: 3,
        processed: 3,
        succeeded: 1,
        failed: 2,
        errors: [
          {
            workId: 'WORK-1',
            error: 'deleted',
            reason: EMBEDDING_FAILURE_REASON.NOT_FOUND,
          },
          {
            workId: 'WORK-2',
            error: 'stale',
            reason: EMBEDDING_FAILURE_REASON.STALE_VERSION,
          },
        ],
      });
    vi.spyOn(databaseFactory, 'createDatabaseClient').mockReturnValue(createMockDatabaseClient());

    const env = {
      HYPERDRIVE: createMockHyperdrive(),
      VECTORIZE: {} as Env['VECTORIZE'],
      OPENAI_MODEL_EMBEDDING: 'text-embedding-3-small',
      OPENAI_API_KEY: 'test',
      AI_GATEWAY_BASE_URL: 'https://gateway.test',
      AI_GATEWAY_ID: 'test',
      OPENAI_MODEL_CHAT: 'gpt-5.2',
      OPENAI_MODEL_LIGHTWEIGHT: 'gpt-5-mini',
      ENVIRONMENT: 'test',
      ASSETS: {} as Env['ASSETS'],
      AI_GATEWAY: {} as Env['AI_GATEWAY'],
      R2_BUCKET: {} as Env['R2_BUCKET'],
      CLOUDFLARE_ACCOUNT_ID: 'test-account',
      GOOGLE_CLIENT_ID: 'test-client',
      GOOGLE_CLIENT_SECRET: 'test-secret',
      GOOGLE_REDIRECT_URI: 'https://example.test/callback',
      GDRIVE_ROOT_FOLDER_ID: 'test-root',
    } as unknown as Env;

    const controller = {
      cron: '*/5 * * * *',
      scheduledTime: Date.now(),
    } as ScheduledController;

    (
      worker as unknown as {
        scheduled: (controller: ScheduledController, env: Env, ctx: ExecutionContext) => void;
      }
    ).scheduled(controller, env, ctx);

    const scheduledPromise = waitUntil.mock.calls[0]?.[0] as Promise<void>;
    await scheduledPromise;

    expect(embedPendingSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('[EmbeddingScheduler] embed-pending run complete', {
      total: 3,
      processed: 3,
      succeeded: 1,
      failed: 2,
      skipReasons: {
        deleted: 1,
        staleVersion: 1,
      },
    });

    warnSpy.mockRestore();
    embedPendingSpy.mockRestore();
  });
});
