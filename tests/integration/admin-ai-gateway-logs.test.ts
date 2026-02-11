/**
 * Integration tests for admin AI Gateway logs route
 */

import { SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authFetch, testEnv } from '../test-setup';

describe('Admin AI Gateway Logs Route', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    originalFetch = global.fetch;
    testEnv.CLOUDFLARE_API_TOKEN = 'test-cloudflare-api-token';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns 401 without authentication', async () => {
    const response = await SELF.fetch('http://localhost/api/admin/ai-gateway/logs');
    expect(response.status).toBe(401);
  });

  it('returns 200 with logs and pagination when request is valid', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('api.cloudflare.com/client/v4/accounts/')) {
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              logs: [
                {
                  id: 'log-route-1',
                  created_at: '2026-02-10T12:00:00.000Z',
                  provider: 'openai',
                  path: '/openai/chat/completions',
                  request_type: 'chat.completions',
                  status_code: 200,
                  success: true,
                  tokens_in: 12,
                  tokens_out: 5,
                  event: 'response',
                  cached: false,
                  request_body: { hidden: true },
                },
              ],
              pagination: {
                page: 1,
                per_page: 5,
                count: 1,
                total_count: 1,
                total_pages: 1,
              },
            },
          }),
          { status: 200 }
        );
      }
      return originalFetch(input);
    });
    global.fetch = fetchMock as typeof fetch;

    const response = await authFetch('/api/admin/ai-gateway/logs?page=1&perPage=5');

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.pagination).toEqual({
      page: 1,
      perPage: 5,
      count: 1,
      totalCount: 1,
      totalPages: 1,
    });
    expect(body.logs).toHaveLength(1);
    expect(body.logs[0]).toMatchObject({
      id: 'log-route-1',
      provider: 'openai',
      path: '/openai/chat/completions',
      requestType: 'chat.completions',
      statusCode: 200,
      success: true,
      tokensIn: 12,
      tokensOut: 5,
      event: 'response',
      cached: false,
    });
    expect(body.logs[0].request_body).toBeUndefined();
  });

  it('returns 400 for invalid query params', async () => {
    const response = await authFetch('/api/admin/ai-gateway/logs?perPage=101');
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('propagates upstream API errors', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('api.cloudflare.com/client/v4/accounts/')) {
        return new Response('Too Many Requests', { status: 429 });
      }
      return originalFetch(input);
    });
    global.fetch = fetchMock as typeof fetch;

    const response = await authFetch('/api/admin/ai-gateway/logs');
    expect(response.status).toBe(429);

    const body = await response.json();
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
