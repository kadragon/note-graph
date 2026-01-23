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

describe('pwaOptions registerType', () => {
  it('uses prompt registration to surface update prompts', () => {
    expect(pwaOptions.registerType).toBe('prompt');
  });
});

describe('pwaOptions runtimeCaching', () => {
  it('uses NetworkOnly for /api requests', () => {
    const runtimeCaching = pwaOptions.workbox?.runtimeCaching ?? [];
    const apiRule = runtimeCaching.find((rule) => {
      if (typeof rule.urlPattern !== 'function') return false;
      const matchOptions: Parameters<typeof rule.urlPattern>[0] = {
        url: new URL('https://example.com/api/work-notes'),
        request: new Request('https://example.com/api/work-notes'),
        event: {} as Parameters<typeof rule.urlPattern>[0]['event'],
        sameOrigin: true,
      };
      return rule.urlPattern(matchOptions);
    });

    expect(apiRule?.handler).toBe('NetworkOnly');
  });
});
