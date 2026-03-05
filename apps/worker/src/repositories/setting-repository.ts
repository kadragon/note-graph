/**
 * Setting repository for database operations
 */

import type { AppSetting } from '@shared/types/setting';
import type { DatabaseClient } from '../types/database';
import { NotFoundError } from '../types/errors';

interface AppSettingRow {
  key: string;
  value: string;
  category: string;
  label: string;
  description: string | null;
  defaultValue: string;
  updatedAt: string;
}

export interface DefaultSetting {
  key: string;
  value: string;
  category: string;
  label: string;
  description: string | null;
}

export class SettingRepository {
  constructor(private db: DatabaseClient) {}

  private toAppSetting(row: AppSettingRow): AppSetting {
    return {
      key: row.key,
      value: row.value,
      category: row.category,
      label: row.label,
      description: row.description,
      defaultValue: row.defaultValue,
      updatedAt: row.updatedAt,
    };
  }

  async findAll(category?: string): Promise<AppSetting[]> {
    let sql = `SELECT key, value, category, label, description,
               default_value as defaultValue, updated_at as updatedAt
               FROM app_settings`;
    const params: string[] = [];

    if (category) {
      sql += ` WHERE category = ?`;
      params.push(category);
    }

    sql += ` ORDER BY key ASC`;

    const result = await this.db.query<AppSettingRow>(sql, params);

    return result.rows.map((row) => this.toAppSetting(row));
  }

  async findByKey(key: string): Promise<AppSetting | null> {
    const result = await this.db.queryOne<AppSettingRow>(
      `SELECT key, value, category, label, description,
       default_value as defaultValue, updated_at as updatedAt
       FROM app_settings WHERE key = ?`,
      [key]
    );

    return result ? this.toAppSetting(result) : null;
  }

  async upsert(key: string, value: string): Promise<AppSetting> {
    const existing = await this.findByKey(key);
    if (!existing) {
      throw new NotFoundError('AppSetting', key);
    }

    await this.db.execute(
      `UPDATE app_settings SET value = ?, updated_at = datetime('now') WHERE key = ?`,
      [value, key]
    );

    const updated = await this.findByKey(key);
    return updated as AppSetting;
  }

  async resetToDefault(key: string): Promise<AppSetting> {
    const existing = await this.findByKey(key);
    if (!existing) {
      throw new NotFoundError('AppSetting', key);
    }

    await this.db.execute(
      `UPDATE app_settings SET value = default_value, updated_at = datetime('now') WHERE key = ?`,
      [key]
    );

    const updated = await this.findByKey(key);
    return updated as AppSetting;
  }

  async ensureDefaults(defaults: DefaultSetting[]): Promise<void> {
    if (defaults.length === 0) return;

    await this.db.executeBatch(
      defaults.map((d) => ({
        sql: `INSERT OR IGNORE INTO app_settings (key, value, category, label, description, default_value)
              VALUES (?, ?, ?, ?, ?, ?)`,
        params: [d.key, d.value, d.category, d.label, d.description, d.value],
      }))
    );
  }
}
