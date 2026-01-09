// Trace: SPEC-person-1, TASK-021

import { DEPARTMENT_SEARCH_LIMIT } from '@web/constants/search';
import { APIClient } from '@web/lib/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('APIClient.getDepartments', () => {
  const api = new APIClient();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should call /departments without query when no params provided', async () => {
    const fakeResponse = new Response(JSON.stringify([]), { status: 200 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeResponse as Response);

    await api.getDepartments();

    expect(fetchSpy).toHaveBeenCalledWith('/api/departments', expect.any(Object));
  });

  it('should append q and limit parameters when provided', async () => {
    const fakeResponse = new Response(JSON.stringify([]), { status: 200 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeResponse as Response);

    await api.getDepartments({ q: '개발', limit: DEPARTMENT_SEARCH_LIMIT });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/departments?q=%EA%B0%9C%EB%B0%9C&limit=5',
      expect.any(Object)
    );
  });

  it('should pass abort signal when provided', async () => {
    const fakeResponse = new Response(JSON.stringify([]), { status: 200 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeResponse as Response);
    const controller = new AbortController();

    await api.getDepartments({ q: '개발' }, controller.signal);

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/departments?q=%EA%B0%9C%EB%B0%9C',
      expect.objectContaining({ signal: controller.signal })
    );
  });
});
