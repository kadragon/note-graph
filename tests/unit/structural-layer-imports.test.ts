import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const ROUTES_DIR = path.resolve(__dirname, '../../apps/worker/src/routes');
const REPO_DIR_NAME = 'repositories';

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

describe('Structural: layer import rules', () => {
  const routeFiles = getRouteFiles(ROUTES_DIR);

  it('should have route files to check', () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  it.each(
    routeFiles.map((f) => [path.relative(ROUTES_DIR, f), f])
  )('routes/%s must not import from repositories', (_relPath, filePath) => {
    const content = fs.readFileSync(filePath as string, 'utf-8');
    const importLines = content
      .split('\n')
      .filter((line) => /^\s*import\s/.test(line))
      .filter((line) => line.includes(REPO_DIR_NAME));

    expect(importLines).toEqual([]);
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
    const importLines = content
      .split('\n')
      .filter((line) => /^\s*import\s/.test(line))
      .filter((line) => line.includes('/services/'));

    expect(importLines).toEqual([]);
  });

  it.each(
    repoFiles.map((f) => [path.basename(f), f])
  )('repositories/%s must not import from routes', (_name, filePath) => {
    const content = fs.readFileSync(filePath as string, 'utf-8');
    const importLines = content
      .split('\n')
      .filter((line) => /^\s*import\s/.test(line))
      .filter((line) => line.includes('/routes/'));

    expect(importLines).toEqual([]);
  });

  it.each(
    serviceFiles.map((f) => [path.basename(f), f])
  )('services/%s must not import from routes', (_name, filePath) => {
    const content = fs.readFileSync(filePath as string, 'utf-8');
    const importLines = content
      .split('\n')
      .filter((line) => /^\s*import\s/.test(line))
      .filter((line) => line.includes('/routes/'));

    expect(importLines).toEqual([]);
  });
});
