import worker from '@worker/index';
import { EMBEDDING_FAILURE_REASON, EmbeddingProcessor } from '@worker/services/embedding-processor';
import type { Env } from '@worker/types/env';
import { describe, expect, it, vi } from 'vitest';

describe('Worker scheduled handler', () => {
  it('runs embedPending through waitUntil', async () => {
    const waitUntil = vi.fn();
    const ctx = { waitUntil } as unknown as ExecutionContext;
    const dbMock = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({
        total: 1,
        embedded: 1,
        pending: 0,
      }),
    };
    const env = {
      DB: dbMock,
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

    expect(dbMock.prepare).toHaveBeenCalled();
  });

  it('counts scheduled skip reasons from error reason codes', async () => {
    const waitUntil = vi.fn();
    const ctx = { waitUntil } as unknown as ExecutionContext;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
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

    const env = {
      DB: {} as Env['DB'],
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
