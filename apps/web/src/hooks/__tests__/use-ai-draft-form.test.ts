import { act } from '@testing-library/react';
import { useAIDraftForm } from '@web/hooks/use-ai-draft-form';
import { usePersons } from '@web/hooks/use-persons';
import { useTaskCategories } from '@web/hooks/use-task-categories';
import { API } from '@web/lib/api';
import { createTaskCategory } from '@web/test/factories';
import { renderHookWithClient } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@web/hooks/use-task-categories', () => ({
  useTaskCategories: vi.fn(),
}));

vi.mock('@web/hooks/use-persons', () => ({
  usePersons: vi.fn(),
}));

const mockToast = vi.fn();
vi.mock('@web/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@web/lib/api', () => ({
  API: {
    createWorkNote: vi.fn(),
    createWorkNoteTodo: vi.fn(),
  },
}));

describe('useAIDraftForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(usePersons).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof usePersons>);
  });

  it('requests only active categories', () => {
    vi.mocked(useTaskCategories).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskCategories>);

    renderHookWithClient(() => useAIDraftForm());

    expect(useTaskCategories).toHaveBeenCalledWith(true);
  });

  it('exposes categories returned by the active-only query', () => {
    const activeCategory = createTaskCategory({
      categoryId: 'cat-active',
      name: '활성',
      isActive: true,
    });

    vi.mocked(useTaskCategories).mockReturnValue({
      data: [activeCategory],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskCategories>);

    const { result } = renderHookWithClient(() => useAIDraftForm());

    expect(result.current.data.taskCategories).toEqual([activeCategory]);
  });

  it('preselects suggested meeting references and excludes unchecked meeting references on submit', async () => {
    vi.mocked(useTaskCategories).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskCategories>);
    vi.mocked(API.createWorkNote).mockResolvedValue({ id: 'work-1' } as never);
    vi.mocked(API.createWorkNoteTodo).mockResolvedValue({} as never);

    const { result } = renderHookWithClient(() => useAIDraftForm());

    act(() => {
      (
        result.current.actions as unknown as {
          populateDraft: (
            draft: { title: string; content: string; category: string; todos: [] },
            refs?: never[],
            meetingRefs?: Array<{
              meetingId: string;
              meetingDate: string;
              topic: string;
              keywords: string[];
              score: number;
            }>
          ) => void;
        }
      ).populateDraft(
        {
          title: 'AI 초안 제목',
          content: 'AI 초안 내용',
          category: '',
          todos: [],
        },
        [],
        [
          {
            meetingId: 'MEET-001',
            meetingDate: '2026-02-11',
            topic: '주간 회의',
            keywords: ['주간'],
            score: 1.2,
          },
          {
            meetingId: 'MEET-002',
            meetingDate: '2026-02-10',
            topic: '스프린트 회고',
            keywords: ['회고'],
            score: 1.1,
          },
        ]
      );
    });

    expect(
      (result.current.state as unknown as { selectedMeetingReferenceIds: string[] })
        .selectedMeetingReferenceIds
    ).toEqual(['MEET-001', 'MEET-002']);

    act(() => {
      (
        result.current.actions as unknown as {
          setSelectedMeetingReferenceIds: (ids: string[]) => void;
        }
      ).setSelectedMeetingReferenceIds(['MEET-001']);
    });

    await act(async () => {
      await result.current.actions.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(API.createWorkNote).toHaveBeenCalledWith(
      expect.objectContaining({
        relatedMeetingIds: ['MEET-001'],
      })
    );

    const payload = vi.mocked(API.createWorkNote).mock.calls.at(-1)?.[0] as
      | { relatedMeetingIds?: string[] }
      | undefined;
    expect(payload?.relatedMeetingIds).not.toContain('MEET-002');
  });
});
