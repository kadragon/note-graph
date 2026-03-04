/**
 * Setting service for managing app settings with caching
 */

import type { AppSetting } from '@shared/types/setting';
import type { SettingRepository } from '../repositories/setting-repository';
import { ALL_DEFAULT_SETTINGS } from './setting-defaults';

export class SettingService {
  private cache: Map<string, AppSetting> | null = null;

  constructor(private repository: SettingRepository) {}

  /**
   * Preload all settings into memory cache.
   * Seeds defaults only when missing keys are detected (first deploy or new settings added).
   */
  async preload(): Promise<void> {
    const settings = await this.repository.findAll();
    const existingKeys = new Set(settings.map((s) => s.key));
    const needsSeed = ALL_DEFAULT_SETTINGS.some((d) => !existingKeys.has(d.key));

    if (needsSeed) {
      await this.repository.ensureDefaults(ALL_DEFAULT_SETTINGS);
      const seeded = await this.repository.findAll();
      this.cache = new Map(seeded.map((s) => [s.key, s]));
    } else {
      this.cache = new Map(settings.map((s) => [s.key, s]));
    }
  }

  /**
   * Get a setting value from cache, falling back to hardcodedDefault.
   */
  getValue(key: string, hardcodedDefault: string): string {
    if (!this.cache) {
      return hardcodedDefault;
    }
    const setting = this.cache.get(key);
    return setting?.value ?? hardcodedDefault;
  }

  /**
   * Get a config value: DB override → env fallback.
   * Empty string in DB means "use env value".
   */
  getConfigOrEnv(key: string, envValue: string): string {
    if (!this.cache) {
      return envValue;
    }
    const setting = this.cache.get(key);
    const dbValue = setting?.value;
    return dbValue && dbValue.length > 0 ? dbValue : envValue;
  }
}
