// Trace: SPEC-dept-1, TASK-022
// Ensure API client sends correct payload when creating departments

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API } from './api';

describe('API.createDepartment', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends deptName in request body', async () => {
    const now = new Date().toISOString();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: vi.fn().mockResolvedValue({
        deptName: '교무기획부',
        description: null,
        createdAt: now,
      }),
    });

    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await API.createDepartment({ deptName: '교무기획부' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/departments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ deptName: '교무기획부' }),
      })
    );
  });
});
