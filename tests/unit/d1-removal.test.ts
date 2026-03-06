import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function repoRoot(): string {
  return process.cwd();
}

function grepR(pattern: string, ...paths: string[]): string {
  try {
    return execFileSync(
      'grep',
      [
        '-rnE',
        '--include=*.ts',
        '--include=*.json',
        '--include=*.toml',
        '--include=*.md',
        pattern,
        ...paths,
      ],
      { cwd: repoRoot(), encoding: 'utf8' }
    );
  } catch (error) {
    const failed = error as { status?: number; stdout?: string };
    if (failed.status === 1) {
      return failed.stdout ?? '';
    }
    throw error;
  }
}

function filterLines(output: string, excludePattern: RegExp): string {
  return output
    .split('\n')
    .filter((line) => line && !excludePattern.test(line))
    .join('\n');
}

const SELF_EXCLUDE = /tests\/unit\/d1-removal\.test\.ts|\/dist\//;

describe('D1 removal cleanup', () => {
  it('removes D1-only adapters and legacy test setup references', () => {
    const raw = grepR(
      'd1-database-client|d1-fts-dialect|tests/setup\\.ts|tests/test-setup\\.ts|D1DatabaseClient|D1FtsDialect',
      'apps',
      'tests',
      'scripts'
    );
    const references = filterLines(raw, SELF_EXCLUDE).trim();

    expect(references).toBe('');
    expect(existsSync('apps/worker/src/adapters/d1-database-client.ts')).toBe(false);
    expect(existsSync('apps/worker/src/adapters/d1-fts-dialect.ts')).toBe(false);
    expect(existsSync('tests/setup.ts')).toBe(false);
    expect(existsSync('tests/test-setup.ts')).toBe(false);
  });

  it('removes D1-specific scripts and runtime configuration', () => {
    const raw = grepR(
      '\\[\\[d1_databases\\]\\]|wrangler d1 migrations|D1Database|d1Databases|getD1Database|d1Persist|createD1Connection|export-d1-for-supabase|migrate-d1-to-supabase|export-d1-chunked',
      'apps',
      'tests',
      'scripts',
      'package.json',
      'wrangler.toml'
    );
    const references = filterLines(raw, SELF_EXCLUDE).trim();

    expect(references).toBe('');
    expect(existsSync('scripts/export-d1-for-supabase.ts')).toBe(false);
    expect(existsSync('scripts/migrate-d1-to-supabase.ts')).toBe(false);
    expect(existsSync('scripts/export-d1-chunked.ts')).toBe(false);
  });

  it('removes D1 FTS query builders and SQLite-isms from production code', () => {
    const raw = grepR(
      'buildWorkNoteFtsQuery|buildMeetingMinutesFtsQuery|json_each|\\bD1\\b|SQLite|FTS5|notes_fts',
      'apps'
    );
    const references = filterLines(raw, SELF_EXCLUDE).trim();

    expect(references).toBe('');
  });

  it('removes stale D1, Miniflare, and SQLite-era references from repo docs', () => {
    const raw = grepR(
      '\\bD1\\b|wrangler d1|miniflare|Miniflare|SQLite|sqlite_master|d1_databases|FTS5|notes_fts',
      'README.md',
      'tests/README.md',
      'migrations/README.md',
      'TEST_STRUCTURE.md',
      'AGENTS.md'
    );
    const exclude = /tests\/unit\/d1-removal\.test\.ts|\/dist\/|plan\.md/;
    const references = filterLines(raw, exclude).trim();

    expect(references).toBe('');
  });
});
