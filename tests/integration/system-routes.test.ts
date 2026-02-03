// Trace: TASK-016
// Basic API integration tests for core system routes.

import { env, SELF } from 'cloudflare:test';
import type { Env } from '@worker/types/env';
import { describe, expect, it } from 'vitest';

import { authFetch } from '../test-setup';

describe('System API Routes', () => {
  describe('Health Check', () => {
    it('should return 200 for /health endpoint', async () => {
      const response = await SELF.fetch('http://localhost/health');
      expect(response.status).toBe(200);

      const data = await response.json<{ status: string; service: string }>();
      expect(data.status).toBe('ok');
      expect(data.service).toBe('note-graph');
    });
  });

  describe('API Info Endpoint', () => {
    it('should return API information', async () => {
      const response = await SELF.fetch('http://localhost/api');
      expect(response.status).toBe(200);

      const data = await response.json<{ name: string; version: string }>();
      expect(data.name).toBe('Note Graph API');
      expect(data.version).toBe('0.1.0');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for /api/me endpoint', async () => {
      const originalEnv = env.ENVIRONMENT;
      (env as unknown as Env).ENVIRONMENT = 'production';

      try {
        const response = await SELF.fetch('http://localhost/api/me');
        expect(response.status).toBe(401);

        const data = await response.json<{ code: string; message: string }>();
        expect(data.code).toBe('UNAUTHORIZED');
      } finally {
        (env as unknown as Env).ENVIRONMENT = originalEnv;
      }
    });

    it('should accept authenticated requests with Cloudflare Access headers', async () => {
      const response = await authFetch('/api/me');

      expect(response.status).toBe(200);

      const data = await response.json<{ email: string }>();
      expect(data.email).toBe('test@example.com');
    });
  });

  describe('Google Drive Status', () => {
    it('should include configuration header on status endpoint', async () => {
      const testEnv = env as unknown as Env;
      const originalClientId = testEnv.GOOGLE_CLIENT_ID;
      const originalSecret = testEnv.GOOGLE_CLIENT_SECRET;
      const originalRootFolderId = testEnv.GDRIVE_ROOT_FOLDER_ID;

      testEnv.GOOGLE_CLIENT_ID = 'test-client-id';
      testEnv.GOOGLE_CLIENT_SECRET = 'test-client-secret';
      testEnv.GDRIVE_ROOT_FOLDER_ID = 'test-root-folder';

      try {
        const response = await authFetch('/api/auth/google/status');

        expect(response.status).toBe(200);
        expect(response.headers.get('X-Google-Drive-Configured')).toBe('true');

        const data = await response.json<{ connected: boolean; needsReauth: boolean }>();
        expect(data.connected).toBe(false);
        expect(data.needsReauth).toBe(false);
      } finally {
        testEnv.GOOGLE_CLIENT_ID = originalClientId;
        testEnv.GOOGLE_CLIENT_SECRET = originalSecret;
        testEnv.GDRIVE_ROOT_FOLDER_ID = originalRootFolderId;
      }
    });

    it('should return needsReauth=true for legacy drive.file scope', async () => {
      const testEnv = env as unknown as Env;
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 3600000).toISOString();

      // Insert OAuth token with legacy drive.file scope
      await testEnv.DB.prepare(
        `INSERT INTO google_oauth_tokens
          (user_email, access_token, refresh_token, token_type, expires_at, scope, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          'test@example.com',
          'access-token',
          'refresh-token',
          'Bearer',
          expiresAt,
          'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.readonly',
          now,
          now
        )
        .run();

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
        await testEnv.DB.prepare(`DELETE FROM google_oauth_tokens WHERE user_email = ?`)
          .bind('test@example.com')
          .run();
      }
    });

    it('should return needsReauth=false for full drive scope', async () => {
      const testEnv = env as unknown as Env;
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 3600000).toISOString();

      // Insert OAuth token with full drive scope
      await testEnv.DB.prepare(
        `INSERT INTO google_oauth_tokens
          (user_email, access_token, refresh_token, token_type, expires_at, scope, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          'test@example.com',
          'access-token',
          'refresh-token',
          'Bearer',
          expiresAt,
          'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar.readonly',
          now,
          now
        )
        .run();

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
        await testEnv.DB.prepare(`DELETE FROM google_oauth_tokens WHERE user_email = ?`)
          .bind('test@example.com')
          .run();
      }
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await SELF.fetch('http://localhost/non-existent');
      expect(response.status).toBe(404);

      const data = await response.json<{ error: string; message: string }>();
      expect(data.error).toBe('Not Found');
    });
  });
});
