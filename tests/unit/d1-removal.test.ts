import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function repoRoot(): string {
  return process.cwd();
}

function rg(...args: string[]): string {
  try {
    return execFileSync('rg', args, {
      cwd: repoRoot(),
      encoding: 'utf8',
    });
  } catch (error) {
    const failed = error as { status?: number; stdout?: string };
    if (failed.status === 1) {
      return failed.stdout ?? '';
    }
    throw error;
  }
}

describe('D1 removal cleanup', () => {
  it('removes D1-only adapters and legacy test setup references', () => {
    const references = rg(
      '-n',
      'd1-database-client|d1-fts-dialect|tests/setup\\.ts|tests/test-setup\\.ts|D1DatabaseClient|D1FtsDialect',
      'apps',
      'tests',
      'scripts',
      '-g',
      '!**/dist/**',
      '-g',
      '!tests/unit/d1-removal.test.ts'
    ).trim();

    expect(references).toBe('');
    expect(existsSync('apps/worker/src/adapters/d1-database-client.ts')).toBe(false);
    expect(existsSync('apps/worker/src/adapters/d1-fts-dialect.ts')).toBe(false);
    expect(existsSync('tests/setup.ts')).toBe(false);
    expect(existsSync('tests/test-setup.ts')).toBe(false);
  });

  it('removes D1-specific scripts and runtime configuration', () => {
    const references = rg(
      '-n',
      '\\[\\[d1_databases\\]\\]|wrangler d1 migrations|D1Database|d1Databases|getD1Database|d1Persist|createD1Connection|export-d1-for-supabase|migrate-d1-to-supabase|export-d1-chunked',
      'package.json',
      'wrangler.toml',
      'scripts',
      '-g',
      '!**/dist/**',
      '-g',
      '!tests/unit/d1-removal.test.ts'
    ).trim();

    expect(references).toBe('');
    expect(existsSync('scripts/export-d1-for-supabase.ts')).toBe(false);
    expect(existsSync('scripts/migrate-d1-to-supabase.ts')).toBe(false);
    expect(existsSync('scripts/export-d1-chunked.ts')).toBe(false);
  });

  it('removes stale D1 and Miniflare documentation from repo docs', () => {
    const references = rg(
      '-n',
      '\\bD1\\b|wrangler d1|miniflare|Miniflare|SQLite|sqlite_master|d1_databases',
      'README.md',
      'tests/README.md',
      'migrations/README.md',
      'TEST_STRUCTURE.md',
      '-g',
      '!tests/unit/d1-removal.test.ts'
    ).trim();

    expect(references).toBe('');
  });
});
