import { act, waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import { createPerson, resetFactoryCounter } from '@web/test/factories';
import { createTestQueryClient, renderHookWithClient } from '@web/test/setup';
import type { ImportPersonResponse, ParsedPersonData } from '@web/types/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useCreatePerson,
  useImportPerson,
  useParsePersonFromText,
  useUpdatePerson,
} from '../use-persons';

vi.mock('@web/lib/api', () => ({
  API: {
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
});
