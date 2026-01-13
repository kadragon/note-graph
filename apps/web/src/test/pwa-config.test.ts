import { pwaOptions } from '@web/lib/pwa-config';
import { describe, expect, it } from 'vitest';

describe('pwaOptions', () => {
  it('excludes API routes from SPA navigation fallback', () => {
    const denylist = pwaOptions.workbox?.navigateFallbackDenylist ?? [];
    const matchesApi = denylist.some(
      (pattern) =>
        pattern instanceof RegExp && pattern.test('/api/work-notes/work-1/files/file-1/view')
    );

    expect(matchesApi).toBe(true);
  });
});
