import { forcePwaRefresh, isPwaCacheName } from '@web/lib/pwa-reload';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('isPwaCacheName', () => {
  it.each([
    ['workbox-precache-v2', true],
    ['vite-pwa-assets', true],
    ['app-runtime-cache', false],
    ['custom-cache', false],
  ])('returns %s for cache %s', (cacheName, expected) => {
    expect(isPwaCacheName(cacheName)).toBe(expected);
  });
});

describe('forcePwaRefresh', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    const replace = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        href: 'https://example.com/work-notes?tab=all',
        replace,
      },
    });
  });

  it('unregisters service workers before replacing location', async () => {
    const unregisterA = vi.fn().mockResolvedValue(true);
    const unregisterB = vi.fn().mockResolvedValue(true);
    const getRegistrations = vi
      .fn()
      .mockResolvedValue([{ unregister: unregisterA }, { unregister: unregisterB }]);

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistrations,
      },
    });

    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: {
        keys: vi.fn().mockResolvedValue([]),
        delete: vi.fn(),
      },
    });

    await forcePwaRefresh();

    expect(getRegistrations).toHaveBeenCalledTimes(1);
    expect(unregisterA).toHaveBeenCalledTimes(1);
    expect(unregisterB).toHaveBeenCalledTimes(1);
    expect(window.location.replace).toHaveBeenCalledWith('https://example.com/work-notes?tab=all');
  });

  it('deletes only pwa cache names', async () => {
    const cacheDelete = vi.fn().mockResolvedValue(true);

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistrations: vi.fn().mockResolvedValue([]),
      },
    });

    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: {
        keys: vi.fn().mockResolvedValue(['workbox-precache-v2', 'vite-pwa-assets', 'other-cache']),
        delete: cacheDelete,
      },
    });

    await forcePwaRefresh();

    expect(cacheDelete).toHaveBeenCalledTimes(2);
    expect(cacheDelete).toHaveBeenCalledWith('workbox-precache-v2');
    expect(cacheDelete).toHaveBeenCalledWith('vite-pwa-assets');
    expect(cacheDelete).not.toHaveBeenCalledWith('other-cache');
  });
});
