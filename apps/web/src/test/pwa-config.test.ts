import { pwaOptions } from '@web/lib/pwa-config';
import { describe, expect, it } from 'vitest';

describe('pwaOptions navigateFallbackDenylist', () => {
  const denylist = pwaOptions.workbox?.navigateFallbackDenylist ?? [];

  const matchesDenylist = (path: string): boolean =>
    denylist.some((pattern) => pattern instanceof RegExp && pattern.test(path));

  it.each([
    ['/api/work-notes/work-1/files/file-1/view', 'nested API route'],
    ['/api/health', 'API health endpoint'],
    ['/api/', 'API root with trailing slash'],
    ['/health', 'health check endpoint'],
  ])('excludes %s (%s) from SPA navigation fallback', (path) => {
    expect(matchesDenylist(path)).toBe(true);
  });

  it.each([
    ['/', 'root path'],
    ['/dashboard', 'dashboard route'],
    ['/work-notes', 'work notes route'],
    ['/settings', 'settings route'],
    ['/healthy', 'path starting with health but not exact match'],
  ])('does not exclude %s (%s) from SPA navigation fallback', (path) => {
    expect(matchesDenylist(path)).toBe(false);
  });
});
