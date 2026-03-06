// Trace: TASK-016
// Basic API integration tests for core system routes.

import { describe, expect, it, vi } from 'vitest';
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

    it('should accept authenticated requests with Cloudflare Access headers', async () => {
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

  describe('404 Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request('/non-existent');
      expect(response.status).toBe(404);

      const data = await response.json<{ error: string; message: string }>();
      expect(data.error).toBe('Not Found');
    });
  });
});
