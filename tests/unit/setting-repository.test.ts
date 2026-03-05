import { env } from 'cloudflare:test';
import { D1DatabaseClient } from '@worker/adapters/d1-database-client';
import { SettingRepository } from '@worker/repositories/setting-repository';
import type { Env } from '@worker/types/env';
import { beforeEach, describe, expect, it } from 'vitest';

const testEnv = env as unknown as Env;
const testDb = new D1DatabaseClient(testEnv.DB);

describe('SettingRepository', () => {
  let repository: SettingRepository;

  beforeEach(async () => {
    repository = new SettingRepository(testDb);
    await testEnv.DB.prepare('DELETE FROM app_settings').run();
  });

  describe('ensureDefaults()', () => {
    it('inserts default settings when table is empty', async () => {
      await repository.ensureDefaults([
        {
          key: 'test.key1',
          value: 'default1',
          category: 'config',
          label: 'Test Key 1',
          description: 'A test key',
        },
        {
          key: 'test.key2',
          value: 'default2',
          category: 'prompt',
          label: 'Test Key 2',
          description: null,
        },
      ]);

      const all = await repository.findAll();
      expect(all).toHaveLength(2);
      expect(all[0].key).toBe('test.key1');
      expect(all[0].value).toBe('default1');
      expect(all[0].defaultValue).toBe('default1');
      expect(all[0].category).toBe('config');
    });

    it('does not overwrite existing settings (INSERT OR IGNORE)', async () => {
      await repository.ensureDefaults([
        {
          key: 'test.key1',
          value: 'default1',
          category: 'config',
          label: 'Test Key 1',
          description: null,
        },
      ]);

      // Manually update value
      await testEnv.DB.prepare(`UPDATE app_settings SET value = 'custom' WHERE key = ?`)
        .bind('test.key1')
        .run();

      // Run ensureDefaults again
      await repository.ensureDefaults([
        {
          key: 'test.key1',
          value: 'default1',
          category: 'config',
          label: 'Test Key 1',
          description: null,
        },
      ]);

      const setting = await repository.findByKey('test.key1');
      expect(setting?.value).toBe('custom');
    });
  });

  describe('findAll()', () => {
    it('returns all settings sorted by key', async () => {
      await repository.ensureDefaults([
        { key: 'b.key', value: 'v1', category: 'config', label: 'B', description: null },
        { key: 'a.key', value: 'v2', category: 'prompt', label: 'A', description: null },
      ]);

      const all = await repository.findAll();
      expect(all).toHaveLength(2);
      expect(all[0].key).toBe('a.key');
      expect(all[1].key).toBe('b.key');
    });

    it('filters by category', async () => {
      await repository.ensureDefaults([
        { key: 'config.key', value: 'v1', category: 'config', label: 'C', description: null },
        { key: 'prompt.key', value: 'v2', category: 'prompt', label: 'P', description: null },
      ]);

      const configs = await repository.findAll('config');
      expect(configs).toHaveLength(1);
      expect(configs[0].key).toBe('config.key');
    });
  });

  describe('findByKey()', () => {
    it('returns null for non-existent key', async () => {
      const result = await repository.findByKey('non.existent');
      expect(result).toBeNull();
    });

    it('returns the setting for existing key', async () => {
      await repository.ensureDefaults([
        { key: 'test.key', value: 'val', category: 'config', label: 'Test', description: 'desc' },
      ]);

      const result = await repository.findByKey('test.key');
      expect(result).not.toBeNull();
      expect(result?.key).toBe('test.key');
      expect(result?.value).toBe('val');
      expect(result?.description).toBe('desc');
    });
  });

  describe('upsert()', () => {
    it('updates existing setting value', async () => {
      await repository.ensureDefaults([
        {
          key: 'test.key',
          value: 'original',
          category: 'config',
          label: 'Test',
          description: null,
        },
      ]);

      const result = await repository.upsert('test.key', 'updated');
      expect(result.value).toBe('updated');
      expect(result.defaultValue).toBe('original');
    });

    it('throws NotFoundError for non-existent key', async () => {
      await expect(repository.upsert('non.existent', 'value')).rejects.toThrow();
    });
  });

  describe('resetToDefault()', () => {
    it('resets value to default_value', async () => {
      await repository.ensureDefaults([
        {
          key: 'test.key',
          value: 'original',
          category: 'config',
          label: 'Test',
          description: null,
        },
      ]);

      await repository.upsert('test.key', 'modified');
      const result = await repository.resetToDefault('test.key');
      expect(result.value).toBe('original');
    });

    it('throws NotFoundError for non-existent key', async () => {
      await expect(repository.resetToDefault('non.existent')).rejects.toThrow();
    });
  });
});
