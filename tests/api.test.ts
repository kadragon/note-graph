// Trace: TASK-016
// Basic API integration tests
// Demonstrates testing infrastructure for Cloudflare Workers

import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import type { Env } from '../src/types/env';

describe('API Integration Tests', () => {
  beforeAll(async () => {
    // Initialize test database if needed
    // Bindings are provided by @cloudflare/vitest-pool-workers
  });

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
    it('should require authentication for /me endpoint', async () => {
      const response = await SELF.fetch('http://localhost/me');
      expect(response.status).toBe(401);

      const data = await response.json<{ code: string; message: string }>();
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('should accept authenticated requests with Cloudflare Access headers', async () => {
      const response = await SELF.fetch('http://localhost/me', {
        headers: {
          'Cf-Access-Authenticated-User-Email': 'test@example.com',
        },
      });

      expect(response.status).toBe(200);

      const data = await response.json<{ email: string }>();
      expect(data.email).toBe('test@example.com');
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
