import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSidebarCollapse } from '../use-sidebar-collapse';

const STORAGE_KEY = 'sidebar-collapsed';
const storage = ensureStorage();

function ensureStorage(): Storage {
  if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function') {
    return localStorage;
  }

  const store = new Map<string, string>();
  const mockStorage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.get(key) ?? null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, value);
    },
  };

  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    configurable: true,
  });

  return mockStorage;
}

describe('useSidebarCollapse', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('initializes to false and then hydrates from localStorage', async () => {
    storage.setItem(STORAGE_KEY, JSON.stringify(true));

    const { result } = renderHook(() => useSidebarCollapse());

    await waitFor(() => {
      expect(result.current.isCollapsed).toBe(true);
    });
  });

  it('toggles state and persists to localStorage', async () => {
    const { result } = renderHook(() => useSidebarCollapse());

    await waitFor(() => {
      expect(storage.getItem(STORAGE_KEY)).toBe('false');
    });

    act(() => {
      result.current.toggle();
    });

    await waitFor(() => {
      expect(result.current.isCollapsed).toBe(true);
    });

    expect(storage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('toggles via keyboard shortcut (Ctrl+B)', async () => {
    const { result } = renderHook(() => useSidebarCollapse());

    await waitFor(() => {
      expect(storage.getItem(STORAGE_KEY)).toBe('false');
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));
    });

    await waitFor(() => {
      expect(result.current.isCollapsed).toBe(true);
    });
  });
});
