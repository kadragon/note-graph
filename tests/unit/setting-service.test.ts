import { SettingRepository } from '@worker/repositories/setting-repository';
import { SettingService } from '@worker/services/setting-service';
import { beforeEach, describe, expect, it } from 'vitest';
import { pglite, testPgDb } from '../pg-setup';

describe('SettingService', () => {
  let repository: SettingRepository;
  let service: SettingService;

  beforeEach(async () => {
    repository = new SettingRepository(testPgDb);
    service = new SettingService(repository);
    await pglite.query('DELETE FROM app_settings');
  });

  describe('getValue()', () => {
    it('returns hardcoded default when not preloaded', () => {
      const result = service.getValue('any.key', 'fallback');
      expect(result).toBe('fallback');
    });

    it('returns DB value after preload', async () => {
      await repository.ensureDefaults([
        {
          key: 'test.key',
          value: 'db-value',
          category: 'config',
          label: 'Test',
          description: null,
        },
      ]);

      await service.preload();
      const result = service.getValue('test.key', 'fallback');
      expect(result).toBe('db-value');
    });

    it('returns hardcoded default for non-existent key after preload', async () => {
      await service.preload();
      const result = service.getValue('missing.key', 'fallback');
      expect(result).toBe('fallback');
    });
  });

  describe('getConfigOrEnv()', () => {
    it('returns env value when not preloaded', () => {
      const result = service.getConfigOrEnv('any.key', 'env-value');
      expect(result).toBe('env-value');
    });

    it('returns DB value when non-empty', async () => {
      await repository.ensureDefaults([
        {
          key: 'config.model',
          value: 'gpt-4',
          category: 'config',
          label: 'Model',
          description: null,
        },
      ]);

      await service.preload();
      const result = service.getConfigOrEnv('config.model', 'env-model');
      expect(result).toBe('gpt-4');
    });

    it('returns env value when DB value is empty string', async () => {
      await repository.ensureDefaults([
        { key: 'config.model', value: '', category: 'config', label: 'Model', description: null },
      ]);

      await service.preload();
      const result = service.getConfigOrEnv('config.model', 'env-model');
      expect(result).toBe('env-model');
    });
  });

  describe('preload()', () => {
    it('seeds defaults and loads all settings', async () => {
      await service.preload();

      // ALL_DEFAULT_SETTINGS should be seeded
      const result = service.getValue('prompt.ai_draft.writer_context', 'fallback');
      expect(result).not.toBe('fallback');
      expect(result).toContain('업무노트');
    });
  });
});
