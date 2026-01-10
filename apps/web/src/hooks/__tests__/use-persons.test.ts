import { act, waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import { createPerson, resetFactoryCounter } from '@web/test/factories';
import { createTestQueryClient, renderHookWithClient } from '@web/test/setup';
import type { ImportPersonResponse, ParsedPersonData, PersonDeptHistory } from '@web/types/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useCreatePerson,
  useImportPerson,
  useParsePersonFromText,
  usePersonHistory,
  usePersons,
  useUpdatePerson,
} from '../use-persons';

// Mock API
vi.mock('@web/lib/api', () => ({
  API: {
    getPersons: vi.fn(),
    createPerson: vi.fn(),
    updatePerson: vi.fn(),
    getPersonHistory: vi.fn(),
    parsePersonFromText: vi.fn(),
    importPerson: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
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
    vi.mocked(API.getPersons).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { result } = renderHookWithClient(() => usePersons());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
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

describe('useCreatePerson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('creates person successfully', async () => {
    const newPerson = createPerson({ name: 'New Person' });
    vi.mocked(API.createPerson).mockResolvedValue(newPerson);

    const { result } = renderHookWithClient(() => useCreatePerson());

    await act(async () => {
      result.current.mutate({
        personId: newPerson.personId,
        name: newPerson.name,
        employmentStatus: '재직',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.createPerson).toHaveBeenCalledWith({
      personId: newPerson.personId,
      name: newPerson.name,
      employmentStatus: '재직',
    });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '사람이 추가되었습니다.',
    });
  });

  it('invalidates both persons and departments queries on success', async () => {
    const newPerson = createPerson();
    vi.mocked(API.createPerson).mockResolvedValue(newPerson);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useCreatePerson(), { queryClient });

    await act(async () => {
      result.current.mutate({
        personId: newPerson.personId,
        name: newPerson.name,
        employmentStatus: '재직',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['persons'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['departments'] });
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

describe('useUpdatePerson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('updates person successfully', async () => {
    const person = createPerson({ personId: 'person-1', name: 'Original Name' });
    const updatedPerson = { ...person, name: 'Updated Name' };
    vi.mocked(API.updatePerson).mockResolvedValue(updatedPerson);

    const { result } = renderHookWithClient(() => useUpdatePerson());

    await act(async () => {
      result.current.mutate({
        personId: 'person-1',
        data: { name: 'Updated Name' },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.updatePerson).toHaveBeenCalledWith('person-1', { name: 'Updated Name' });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '사람 정보가 수정되었습니다.',
    });
  });

  it('invalidates both persons and departments queries on success', async () => {
    const person = createPerson();
    vi.mocked(API.updatePerson).mockResolvedValue(person);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useUpdatePerson(), { queryClient });

    await act(async () => {
      result.current.mutate({
        personId: person.personId,
        data: { name: 'Updated Name' },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['persons'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['departments'] });
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

describe('useParsePersonFromText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('parses person from text successfully', async () => {
    const parsedData: ParsedPersonData = {
      personId: '123456',
      name: 'Test Person',
      phoneExt: '043-123-4567',
      currentDept: 'Engineering',
      currentPosition: 'Engineer',
      currentRoleDesc: 'Backend Development',
      employmentStatus: '재직',
    };
    vi.mocked(API.parsePersonFromText).mockResolvedValue(parsedData);

    const { result } = renderHookWithClient(() => useParsePersonFromText());

    await act(async () => {
      result.current.mutate({ text: '123456 Test Person Engineering' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.parsePersonFromText).toHaveBeenCalledWith({
      text: '123456 Test Person Engineering',
    });
    expect(result.current.data).toEqual(parsedData);
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

  it('does not show success toast (no onSuccess handler)', async () => {
    const parsedData: ParsedPersonData = {
      personId: '123456',
      name: 'Test Person',
      employmentStatus: '재직',
    };
    vi.mocked(API.parsePersonFromText).mockResolvedValue(parsedData);

    const { result } = renderHookWithClient(() => useParsePersonFromText());

    await act(async () => {
      result.current.mutate({ text: 'some text' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Toast should not be called on success
    expect(mockToast).not.toHaveBeenCalled();
  });
});

describe('useImportPerson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('imports new person successfully and shows appropriate toast', async () => {
    const newPerson = createPerson({ name: 'New Import' });
    const response: ImportPersonResponse = {
      person: newPerson,
      isNew: true,
    };
    vi.mocked(API.importPerson).mockResolvedValue(response);

    const { result } = renderHookWithClient(() => useImportPerson());

    await act(async () => {
      result.current.mutate({
        personId: newPerson.personId,
        name: newPerson.name,
        employmentStatus: '재직',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.importPerson).toHaveBeenCalledWith({
      personId: newPerson.personId,
      name: newPerson.name,
      employmentStatus: '재직',
    });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '새 사람이 추가되었습니다.',
    });
  });

  it('imports existing person (update) and shows appropriate toast', async () => {
    const existingPerson = createPerson({ name: 'Existing Person' });
    const response: ImportPersonResponse = {
      person: existingPerson,
      isNew: false,
    };
    vi.mocked(API.importPerson).mockResolvedValue(response);

    const { result } = renderHookWithClient(() => useImportPerson());

    await act(async () => {
      result.current.mutate({
        personId: existingPerson.personId,
        name: existingPerson.name,
        employmentStatus: '재직',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '사람 정보가 업데이트되었습니다.',
    });
  });

  it('invalidates both persons and departments queries on success', async () => {
    const newPerson = createPerson();
    const response: ImportPersonResponse = {
      person: newPerson,
      isNew: true,
    };
    vi.mocked(API.importPerson).mockResolvedValue(response);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useImportPerson(), { queryClient });

    await act(async () => {
      result.current.mutate({
        personId: newPerson.personId,
        name: newPerson.name,
        employmentStatus: '재직',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['persons'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['departments'] });
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
