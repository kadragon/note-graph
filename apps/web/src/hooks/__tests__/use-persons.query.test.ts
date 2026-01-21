import { waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import { createPerson, resetFactoryCounter } from '@web/test/factories';
import { renderHookWithClient } from '@web/test/setup';
import type { PersonDeptHistory } from '@web/types/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePersonHistory, usePersons } from '../use-persons';

vi.mock('@web/lib/api', () => ({
  API: {
    getPersons: vi.fn(),
    getPersonHistory: vi.fn(),
  },
}));

describe('usePersons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('fetches persons successfully', async () => {
    const mockPersons = [createPerson({ name: 'Person 1' }), createPerson({ name: 'Person 2' })];
    vi.mocked(API.getPersons).mockResolvedValue(mockPersons);

    const { result } = renderHookWithClient(() => usePersons());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getPersons).toHaveBeenCalled();
    expect(result.current.data).toEqual(mockPersons);
  });

  it('returns loading state initially', () => {
    vi.mocked(API.getPersons).mockImplementation(() => new Promise(() => {}));

    const { result } = renderHookWithClient(() => usePersons());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});

describe('usePersonHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('fetches person history when personId is provided', async () => {
    const mockHistory: PersonDeptHistory[] = [
      {
        id: 1,
        personId: 'person-1',
        deptName: 'Engineering',
        position: 'Senior Engineer',
        roleDesc: 'Backend Development',
        startDate: '2023-01-01',
        endDate: null,
        isActive: true,
      },
      {
        id: 2,
        personId: 'person-1',
        deptName: 'QA',
        position: 'Engineer',
        roleDesc: 'Quality Assurance',
        startDate: '2022-01-01',
        endDate: '2022-12-31',
        isActive: false,
      },
    ];
    vi.mocked(API.getPersonHistory).mockResolvedValue(mockHistory);

    const { result } = renderHookWithClient(() => usePersonHistory('person-1'));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getPersonHistory).toHaveBeenCalledWith('person-1');
    expect(result.current.data).toEqual(mockHistory);
  });

  it('does not fetch when personId is null', () => {
    const { result } = renderHookWithClient(() => usePersonHistory(null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
    expect(API.getPersonHistory).not.toHaveBeenCalled();
  });

  it('does not fetch when personId is empty string', () => {
    const { result } = renderHookWithClient(() => usePersonHistory(''));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
    expect(API.getPersonHistory).not.toHaveBeenCalled();
  });
});
