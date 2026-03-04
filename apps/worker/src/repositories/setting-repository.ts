/**
 * Setting repository for D1 database operations
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { AppSetting } from '@shared/types/setting';
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
  constructor(private db: D1Database) {}

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

    const stmt = this.db.prepare(sql);
    const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all<AppSettingRow>();

    return (result.results || []).map((row) => this.toAppSetting(row));
  }

  async findByKey(key: string): Promise<AppSetting | null> {
    const result = await this.db
      .prepare(
        `SELECT key, value, category, label, description,
         default_value as defaultValue, updated_at as updatedAt
         FROM app_settings WHERE key = ?`
      )
      .bind(key)
      .first<AppSettingRow>();

    return result ? this.toAppSetting(result) : null;
  }

  async upsert(key: string, value: string): Promise<AppSetting> {
    const existing = await this.findByKey(key);
    if (!existing) {
      throw new NotFoundError('AppSetting', key);
    }

    await this.db
      .prepare(`UPDATE app_settings SET value = ?, updated_at = datetime('now') WHERE key = ?`)
      .bind(value, key)
      .run();

    const updated = await this.findByKey(key);
    return updated as AppSetting;
  }

  async resetToDefault(key: string): Promise<AppSetting> {
    const existing = await this.findByKey(key);
    if (!existing) {
      throw new NotFoundError('AppSetting', key);
    }

    await this.db
      .prepare(
        `UPDATE app_settings SET value = default_value, updated_at = datetime('now') WHERE key = ?`
      )
      .bind(key)
      .run();

    const updated = await this.findByKey(key);
    return updated as AppSetting;
  }

  async ensureDefaults(defaults: DefaultSetting[]): Promise<void> {
    if (defaults.length === 0) return;

    const statements = defaults.map((d) =>
      this.db
        .prepare(
          `INSERT OR IGNORE INTO app_settings (key, value, category, label, description, default_value)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(d.key, d.value, d.category, d.label, d.description, d.value)
    );

    await this.db.batch(statements);
  }
}
