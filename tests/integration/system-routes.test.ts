// Trace: TASK-016
// Basic API integration tests for core system routes.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockDatabaseFactory } from '../helpers/test-app';

vi.mock('@worker/adapters/database-factory', () => mockDatabaseFactory());

import worker from '@worker/index';
import { createAuthFetch, createTestRequest } from '../helpers/test-app';
import { pglite } from '../pg-setup';

const authFetch = createAuthFetch(worker);
const request = createTestRequest(worker);

describe('System API Routes', () => {
  describe('Health Check', () => {
    it('should return 200 for /health endpoint', async () => {
      const response = await request('/health');
      expect(response.status).toBe(200);

      const data = await response.json<{ status: string; service: string }>();
      expect(data.status).toBe('ok');
      expect(data.service).toBe('note-graph');
    });
  });

  describe('API Info Endpoint', () => {
    it('should return API information', async () => {
      const response = await request('/api');
      expect(response.status).toBe(200);

      const data = await response.json<{ name: string; version: string }>();
      expect(data.name).toBe('Note Graph API');
      expect(data.version).toBe('0.1.0');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for /api/me endpoint', async () => {
      const response = await request('/api/me');
      expect(response.status).toBe(401);

      const data = await response.json<{ code: string; message: string }>();
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('should accept authenticated requests', async () => {
      const response = await authFetch('/api/me');

      expect(response.status).toBe(200);

      const data = await response.json<{ email: string }>();
      expect(data.email).toBe('test@example.com');
    });

    it('should require authentication for /api/rag/query endpoint', async () => {
      const response = await request('/api/rag/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'test query',
          scope: 'all',
        }),
      });
      expect(response.status).toBe(401);

      const data = await response.json<{ code: string; message: string }>();
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('should require authentication for /api/pdf-jobs endpoint', async () => {
      const response = await request('/api/pdf-jobs', {
        method: 'POST',
      });
      expect(response.status).toBe(401);

      const data = await response.json<{ code: string; message: string }>();
      expect(data.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Google Drive Status', () => {
    it('should include configuration header on status endpoint', async () => {
      const response = await authFetch('/api/auth/google/status');

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Google-Drive-Configured')).toBe('true');

      const data = await response.json<{ connected: boolean; needsReauth: boolean }>();
      expect(data.connected).toBe(false);
      expect(data.needsReauth).toBe(false);
    });

    it('should return needsReauth=true for legacy drive.file scope', async () => {
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 3600000).toISOString();

      await pglite.query(
        `INSERT INTO google_oauth_tokens
          (user_email, access_token, refresh_token, token_type, expires_at, scope, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'test@example.com',
          'access-token',
          'refresh-token',
          'Bearer',
          expiresAt,
          'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.readonly',
          now,
          now,
        ]
      );

      try {
        const response = await authFetch('/api/auth/google/status');

        expect(response.status).toBe(200);
        const data = await response.json<{
          connected: boolean;
          needsReauth: boolean;
          scope: string;
        }>();
        expect(data.connected).toBe(true);
        expect(data.needsReauth).toBe(true);
        expect(data.scope).toContain('drive.file');
      } finally {
        await pglite.query(`DELETE FROM google_oauth_tokens WHERE user_email = $1`, [
          'test@example.com',
        ]);
      }
    });

    it('should return needsReauth=false for full drive scope', async () => {
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 3600000).toISOString();

      await pglite.query(
        `INSERT INTO google_oauth_tokens
          (user_email, access_token, refresh_token, token_type, expires_at, scope, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'test@example.com',
          'access-token',
          'refresh-token',
          'Bearer',
          expiresAt,
          'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar.readonly',
          now,
          now,
        ]
      );

      try {
        const response = await authFetch('/api/auth/google/status');

        expect(response.status).toBe(200);
        const data = await response.json<{
          connected: boolean;
          needsReauth: boolean;
          scope: string;
        }>();
        expect(data.connected).toBe(true);
        expect(data.needsReauth).toBe(false);
      } finally {
        await pglite.query(`DELETE FROM google_oauth_tokens WHERE user_email = $1`, [
          'test@example.com',
        ]);
      }
    });
  });

  describe('Google OAuth Store Tokens', () => {
    afterEach(async () => {
      await pglite.query(`DELETE FROM google_oauth_tokens WHERE user_email = $1`, [
        'test@example.com',
      ]);
    });

    it('should store provider tokens with accessToken and refreshToken', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn((input: string | URL | Request) => {
          const url =
            typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
          if (url.includes('oauth2.googleapis.com/tokeninfo')) {
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  scope:
                    'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar.readonly',
                  expires_in: 3600,
                }),
                { status: 200 }
              )
            );
          }
          return Promise.resolve(new Response('Not found', { status: 404 }));
        })
      );

      const response = await authFetch('/api/auth/google/store-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: 'provider-access-token',
          refreshToken: 'provider-refresh-token',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json<{ success: boolean }>();
      expect(data.success).toBe(true);

      // Verify tokens were stored
      const statusResponse = await authFetch('/api/auth/google/status');
      const status = await statusResponse.json<{ connected: boolean }>();
      expect(status.connected).toBe(true);

      vi.unstubAllGlobals();
    });

    it('should preserve existing refresh token when refreshToken is null', async () => {
      // First, insert existing tokens
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 3600000).toISOString();
      await pglite.query(
        `INSERT INTO google_oauth_tokens
          (user_email, access_token, refresh_token, token_type, expires_at, scope, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'test@example.com',
          'old-access-token',
          'existing-refresh-token',
          'Bearer',
          expiresAt,
          'https://www.googleapis.com/auth/drive',
          now,
          now,
        ]
      );

      vi.stubGlobal(
        'fetch',
        vi.fn((input: string | URL | Request) => {
          const url =
            typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
          if (url.includes('oauth2.googleapis.com/tokeninfo')) {
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  scope:
                    'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar.readonly',
                  expires_in: 3600,
                }),
                { status: 200 }
              )
            );
          }
          return Promise.resolve(new Response('Not found', { status: 404 }));
        })
      );

      const response = await authFetch('/api/auth/google/store-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: 'new-access-token',
          refreshToken: null,
        }),
      });

      expect(response.status).toBe(200);

      // Verify refresh token was preserved
      const result = await pglite.query<{ refresh_token: string }>(
        `SELECT refresh_token FROM google_oauth_tokens WHERE user_email = $1`,
        ['test@example.com']
      );
      expect(result.rows[0].refresh_token).toBe('existing-refresh-token');

      vi.unstubAllGlobals();
    });

    it('should return 400 when accessToken is missing', async () => {
      const response = await authFetch('/api/auth/google/store-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'some-token' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request('/non-existent');
      expect(response.status).toBe(404);

      const data = await response.json<{ error: string; message: string }>();
      expect(data.error).toBe('Not Found');
    });
  });
});
