import worker from '@worker/index';
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
});
