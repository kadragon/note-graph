import { CloudflareAIGatewayLogService } from '@worker/services/cloudflare-ai-gateway-log-service';
import type { Env } from '@worker/types/env';
import { describe, expect, it, vi } from 'vitest';

describe('CloudflareAIGatewayLogService', () => {
  const createEnv = (overrides?: Partial<Env>): Env =>
    ({
      CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
      AI_GATEWAY_ID: 'test-gateway-id',
      CLOUDFLARE_API_TOKEN: 'test-api-token',
      ...overrides,
    }) as Env;

  it('maps query params to Cloudflare API snake_case and returns metadata-only logs', async () => {
    const service = new CloudflareAIGatewayLogService(createEnv());

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: {
            logs: [
              {
                id: 'log-1',
                created_at: '2026-02-10T12:00:00.000Z',
                started_at: '2026-02-10T11:59:59.000Z',
                provider: 'openai',
                model: 'gpt-5.2',
                path: '/openai/chat/completions',
                request_type: 'chat.completions',
                status_code: 200,
                success: true,
                tokens_in: 101,
                tokens_out: 42,
                event: 'response',
                cached: false,
                request_body: { hidden: 'prompt' },
                response_body: { hidden: 'completion' },
                request_head: { hidden: 'headers' },
                response_head: { hidden: 'headers' },
              },
            ],
            pagination: {
              page: 2,
              per_page: 10,
              count: 1,
              total_count: 21,
              total_pages: 3,
            },
          },
        }),
        { status: 200 }
      )
    );

    const result = await service.listLogs({
      page: 2,
      perPage: 10,
      order: 'asc',
      orderBy: 'started_at',
      search: 'chat',
      startDate: '2026-02-10T00:00:00.000Z',
      endDate: '2026-02-10T23:59:59.000Z',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(url).toContain('/accounts/test-account-id/ai-gateway/gateways/test-gateway-id/logs?');
    expect(url).toContain('page=2');
    expect(url).toContain('per_page=10');
    expect(url).toContain('order=asc');
    expect(url).toContain('order_by=started_at');
    expect(url).toContain('search=chat');
    expect(url).toContain('start_date=2026-02-10T00%3A00%3A00.000Z');
    expect(url).toContain('end_date=2026-02-10T23%3A59%3A59.000Z');
    expect(options.headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer test-api-token',
      })
    );

    expect(result.pagination).toEqual({
      page: 2,
      perPage: 10,
      count: 1,
      totalCount: 21,
      totalPages: 3,
    });
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]).toEqual({
      id: 'log-1',
      createdAt: '2026-02-10T12:00:00.000Z',
      startedAt: '2026-02-10T11:59:59.000Z',
      provider: 'openai',
      model: 'gpt-5.2',
      path: '/openai/chat/completions',
      requestType: 'chat.completions',
      statusCode: 200,
      success: true,
      tokensIn: 101,
      tokensOut: 42,
      event: 'response',
      cached: false,
    });
    expect((result.logs[0] as Record<string, unknown>).request_body).toBeUndefined();
    expect((result.logs[0] as Record<string, unknown>).response_body).toBeUndefined();
  });

  it('throws CONFIGURATION_ERROR when token is missing', async () => {
    const service = new CloudflareAIGatewayLogService(
      createEnv({ CLOUDFLARE_API_TOKEN: undefined })
    );

    await expect(
      service.listLogs({
        page: 1,
        perPage: 20,
        order: 'desc',
        orderBy: 'created_at',
      })
    ).rejects.toMatchObject({
      code: 'CONFIGURATION_ERROR',
      statusCode: 500,
    });
  });

  it('maps 429 to RATE_LIMIT_EXCEEDED', async () => {
    const service = new CloudflareAIGatewayLogService(createEnv());
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Too Many Requests', { status: 429 })
    );

    await expect(
      service.listLogs({
        page: 1,
        perPage: 20,
        order: 'desc',
        orderBy: 'created_at',
      })
    ).rejects.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
    });
  });

  it('maps 401/403 to UPSTREAM_AUTH_ERROR', async () => {
    const service = new CloudflareAIGatewayLogService(createEnv());
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));

    await expect(
      service.listLogs({
        page: 1,
        perPage: 20,
        order: 'desc',
        orderBy: 'created_at',
      })
    ).rejects.toMatchObject({
      code: 'UPSTREAM_AUTH_ERROR',
      statusCode: 502,
    });

    await expect(
      service.listLogs({
        page: 1,
        perPage: 20,
        order: 'desc',
        orderBy: 'created_at',
      })
    ).rejects.toMatchObject({
      code: 'UPSTREAM_AUTH_ERROR',
      statusCode: 502,
    });
  });

  it('maps non-429/401/403 failures to UPSTREAM_API_ERROR', async () => {
    const service = new CloudflareAIGatewayLogService(createEnv());
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Server Error', { status: 500 }));

    await expect(
      service.listLogs({
        page: 1,
        perPage: 20,
        order: 'desc',
        orderBy: 'created_at',
      })
    ).rejects.toMatchObject({
      code: 'UPSTREAM_API_ERROR',
      statusCode: 502,
    });
  });
});
