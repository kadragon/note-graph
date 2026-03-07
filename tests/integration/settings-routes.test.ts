import type { AppSetting } from '@shared/types/setting';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDatabaseFactory } from '../helpers/test-app';

vi.mock('@worker/adapters/database-factory', () => mockDatabaseFactory());

import worker from '@worker/index';
import { pgCleanupAll } from '../helpers/pg-test-utils';
import { createAuthFetch } from '../helpers/test-app';
import { pglite } from '../pg-setup';

const authFetch = createAuthFetch(worker);

describe('Settings Routes', () => {
  beforeEach(async () => {
    await pgCleanupAll(pglite);
  });

  describe('GET /api/settings', () => {
    it('returns all settings (seeded by middleware)', async () => {
      const response = await authFetch('/api/settings');
      expect(response.status).toBe(200);

      const data = await response.json<AppSetting[]>();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it('filters by category', async () => {
      const response = await authFetch('/api/settings?category=config');
      expect(response.status).toBe(200);

      const data = await response.json<AppSetting[]>();
      expect(data.every((s) => s.category === 'config')).toBe(true);
    });
  });

  describe('GET /api/settings/:key', () => {
    it('returns single setting', async () => {
      // First request seeds defaults via middleware
      await authFetch('/api/settings');

      const response = await authFetch('/api/settings/prompt.ai_draft.writer_context');
      expect(response.status).toBe(200);

      const data = await response.json<AppSetting>();
      expect(data.key).toBe('prompt.ai_draft.writer_context');
      expect(data.category).toBe('prompt');
    });

    it('returns 404 for non-existent key', async () => {
      const response = await authFetch('/api/settings/non.existent.key');
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/settings/:key', () => {
    it('updates setting value', async () => {
      // Seed defaults
      await authFetch('/api/settings');

      const response = await authFetch('/api/settings/prompt.ai_draft.writer_context', {
        method: 'PUT',
        body: JSON.stringify({ value: 'custom writer context' }),
      });
      expect(response.status).toBe(200);

      const data = await response.json<AppSetting>();
      expect(data.value).toBe('custom writer context');

      // Verify persistence
      const getResponse = await authFetch('/api/settings/prompt.ai_draft.writer_context');
      const getData = await getResponse.json<AppSetting>();
      expect(getData.value).toBe('custom writer context');
    });

    it('returns 404 for non-existent key', async () => {
      const response = await authFetch('/api/settings/non.existent', {
        method: 'PUT',
        body: JSON.stringify({ value: 'test' }),
      });
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/settings/:key/reset', () => {
    it('resets setting to default value', async () => {
      // Seed and modify
      await authFetch('/api/settings');
      await authFetch('/api/settings/prompt.ai_draft.writer_context', {
        method: 'PUT',
        body: JSON.stringify({ value: 'custom value' }),
      });

      // Reset
      const response = await authFetch('/api/settings/prompt.ai_draft.writer_context/reset', {
        method: 'POST',
      });
      expect(response.status).toBe(200);

      const data = await response.json<AppSetting>();
      expect(data.value).toBe(data.defaultValue);
    });
  });
});
