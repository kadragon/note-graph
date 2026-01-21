import { act, waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import { resetFactoryCounter } from '@web/test/factories';
import { renderHookWithClient } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useCreatePerson,
  useImportPerson,
  useParsePersonFromText,
  usePersonHistory,
  usePersons,
  useUpdatePerson,
} from '../use-persons';

vi.mock('@web/lib/api', () => ({
  API: {
    getPersons: vi.fn(),
    getPersonHistory: vi.fn(),
    createPerson: vi.fn(),
    updatePerson: vi.fn(),
    parsePersonFromText: vi.fn(),
    importPerson: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('usePersons errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('returns error state on API failure', async () => {
    const error = new Error('Network error');
    vi.mocked(API.getPersons).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => usePersons());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(error);
  });
});

describe('usePersonHistory errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('returns error state on API failure', async () => {
    const error = new Error('Network error');
    vi.mocked(API.getPersonHistory).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => usePersonHistory('person-1'));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(error);
  });
});

describe('useCreatePerson errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('shows error toast on failure', async () => {
    const error = new Error('Creation failed');
    vi.mocked(API.createPerson).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useCreatePerson());

    await act(async () => {
      result.current.mutate({
        personId: '123456',
        name: 'Test Person',
        employmentStatus: '재직',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'Creation failed',
    });
  });

  it('shows default error message when error has no message', async () => {
    const error = new Error();
    vi.mocked(API.createPerson).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useCreatePerson());

    await act(async () => {
      result.current.mutate({
        personId: '123456',
        name: 'Test Person',
        employmentStatus: '재직',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: '사람을 추가할 수 없습니다.',
    });
  });
});

describe('useUpdatePerson errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('shows error toast on failure', async () => {
    const error = new Error('Update failed');
    vi.mocked(API.updatePerson).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useUpdatePerson());

    await act(async () => {
      result.current.mutate({
        personId: 'person-1',
        data: { name: 'New Name' },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'Update failed',
    });
  });

  it('shows default error message when error has no message', async () => {
    const error = new Error();
    vi.mocked(API.updatePerson).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useUpdatePerson());

    await act(async () => {
      result.current.mutate({
        personId: 'person-1',
        data: { name: 'New Name' },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: '사람 정보를 수정할 수 없습니다.',
    });
  });
});

describe('useParsePersonFromText errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('shows error toast on failure', async () => {
    const error = new Error('Parse failed');
    vi.mocked(API.parsePersonFromText).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useParsePersonFromText());

    await act(async () => {
      result.current.mutate({ text: 'invalid text' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'Parse failed',
    });
  });

  it('shows default error message when error has no message', async () => {
    const error = new Error();
    vi.mocked(API.parsePersonFromText).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useParsePersonFromText());

    await act(async () => {
      result.current.mutate({ text: 'invalid text' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: '텍스트 파싱에 실패했습니다.',
    });
  });
});

describe('useImportPerson errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('shows error toast on failure', async () => {
    const error = new Error('Import failed');
    vi.mocked(API.importPerson).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useImportPerson());

    await act(async () => {
      result.current.mutate({
        personId: '123456',
        name: 'Test Person',
        employmentStatus: '재직',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'Import failed',
    });
  });

  it('shows default error message when error has no message', async () => {
    const error = new Error();
    vi.mocked(API.importPerson).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useImportPerson());

    await act(async () => {
      result.current.mutate({
        personId: '123456',
        name: 'Test Person',
        employmentStatus: '재직',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: '사람을 가져올 수 없습니다.',
    });
  });
});
