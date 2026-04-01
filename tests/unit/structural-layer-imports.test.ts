import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const ROUTES_DIR = path.resolve(__dirname, '../../apps/worker/src/routes');
const REPO_DIR_NAME = 'repositories';

/**
 * Known route→repository violations tracked in backlog.md for remediation.
 * Remove entries here as each violation is fixed.
 */
const KNOWN_ROUTE_REPO_VIOLATIONS = new Set(['todos.ts', 'meeting-minutes.ts', 'daily-reports.ts']);

function getRouteFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getRouteFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Extract all import source paths from a file, handling both single-line
 * and multiline import statements.
 */
function extractImportSources(content: string): string[] {
  const importRegex = /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  return Array.from(content.matchAll(importRegex), (m) => m[1]);
}

describe('Structural: layer import rules', () => {
  const routeFiles = getRouteFiles(ROUTES_DIR);
  const nonExemptRouteFiles = routeFiles.filter(
    (f) => !KNOWN_ROUTE_REPO_VIOLATIONS.has(path.basename(f))
  );

  it('should have route files to check', () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  it.each(
    nonExemptRouteFiles.map((f) => [path.relative(ROUTES_DIR, f), f])
  )('routes/%s must not import from repositories', (_relPath, filePath) => {
    const content = fs.readFileSync(filePath as string, 'utf-8');
    const violations = extractImportSources(content).filter((src) => src.includes(REPO_DIR_NAME));

    expect(violations).toEqual([]);
  });

  it('known violations list must not contain stale entries', () => {
    const routeBasenames = new Set(routeFiles.map((f) => path.basename(f)));
    for (const known of KNOWN_ROUTE_REPO_VIOLATIONS) {
      expect(routeBasenames.has(known)).toBe(true);
    }
  });

  it('known violations must still actually violate (remove from list when fixed)', () => {
    for (const filename of KNOWN_ROUTE_REPO_VIOLATIONS) {
      const filePath = routeFiles.find((f) => path.basename(f) === filename);
      if (!filePath) continue;
      const content = fs.readFileSync(filePath, 'utf-8');
      const violations = extractImportSources(content).filter((src) => src.includes(REPO_DIR_NAME));
      expect(
        violations.length,
        `${filename} is in KNOWN_VIOLATIONS but no longer violates — remove it`
      ).toBeGreaterThan(0);
    }
  });
});

describe('Structural: no circular imports between layers', () => {
  const REPO_DIR = path.resolve(__dirname, '../../apps/worker/src/repositories');
  const SERVICES_DIR = path.resolve(__dirname, '../../apps/worker/src/services');

  function getTsFiles(dir: string): string[] {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.test.ts'))
      .map((e) => path.join(dir, e.name));
  }

  const repoFiles = getTsFiles(REPO_DIR);
  const serviceFiles = getTsFiles(SERVICES_DIR);

  it('should have repository files to check', () => {
    expect(repoFiles.length).toBeGreaterThan(0);
  });

  it.each(
    repoFiles.map((f) => [path.basename(f), f])
  )('repositories/%s must not import from services', (_name, filePath) => {
    const content = fs.readFileSync(filePath as string, 'utf-8');
    const violations = extractImportSources(content).filter((src) => src.includes('/services/'));
    expect(violations).toEqual([]);
  });

  it.each(
    repoFiles.map((f) => [path.basename(f), f])
  )('repositories/%s must not import from routes', (_name, filePath) => {
    const content = fs.readFileSync(filePath as string, 'utf-8');
    const violations = extractImportSources(content).filter((src) => src.includes('/routes/'));
    expect(violations).toEqual([]);
  });

  it.each(
    serviceFiles.map((f) => [path.basename(f), f])
  )('services/%s must not import from routes', (_name, filePath) => {
    const content = fs.readFileSync(filePath as string, 'utf-8');
    const violations = extractImportSources(content).filter((src) => src.includes('/routes/'));
    expect(violations).toEqual([]);
  });
});
