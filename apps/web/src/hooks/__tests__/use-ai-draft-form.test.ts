import { useAIDraftForm } from '@web/hooks/use-ai-draft-form';
import { usePersons } from '@web/hooks/use-persons';
import { useTaskCategories } from '@web/hooks/use-task-categories';
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

  it('filters inactive categories from the draft form data', () => {
    const activeCategory = createTaskCategory({
      categoryId: 'cat-active',
      name: '활성',
      isActive: true,
    });
    const inactiveCategory = createTaskCategory({
      categoryId: 'cat-inactive',
      name: '비활성',
      isActive: false,
    });

    vi.mocked(useTaskCategories).mockReturnValue({
      data: [activeCategory, inactiveCategory],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskCategories>);

    const { result } = renderHookWithClient(() => useAIDraftForm());

    expect(result.current.data.taskCategories).toEqual([activeCategory]);
  });
});
