import userEvent from '@testing-library/user-event';
import type {
  AIDraftFormActions,
  AIDraftFormData,
  AIDraftFormState,
  SuggestedTodo,
} from '@web/hooks/use-ai-draft-form';
import { createPerson, createTaskCategory } from '@web/test/factories';
import { render, screen } from '@web/test/setup';
import type { AIDraftReference } from '@web/types/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DraftEditorForm } from '../draft-editor-form';

// Mock Checkbox to render as native checkbox for testing
vi.mock('@web/components/ui/checkbox', () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
    disabled,
  }: {
    id?: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={() => onCheckedChange?.(!checked)}
    />
  ),
}));

// Mock AssigneeSelector to render simple UI for testing
vi.mock('@web/components/assignee-selector', () => ({
  AssigneeSelector: ({
    persons,
    selectedPersonIds,
    onSelectionChange,
    isLoading,
  }: {
    persons: Array<{ personId: string; name: string }>;
    selectedPersonIds: string[];
    onSelectionChange: (ids: string[]) => void;
    isLoading?: boolean;
  }) => (
    <div data-testid="assignee-selector">
      {isLoading ? (
        <span>담당자 로딩 중...</span>
      ) : (
        <>
          <span data-testid="selected-count">{selectedPersonIds.length}명 선택됨</span>
          {persons.map((person) => (
            <button
              key={person.personId}
              type="button"
              data-testid={`person-${person.personId}`}
              onClick={() => {
                if (selectedPersonIds.includes(person.personId)) {
                  onSelectionChange(selectedPersonIds.filter((id) => id !== person.personId));
                } else {
                  onSelectionChange([...selectedPersonIds, person.personId]);
                }
              }}
            >
              {person.name}
            </button>
          ))}
        </>
      )}
    </div>
  ),
}));

// Mock AIReferenceList to render simple UI for testing
vi.mock('@web/components/ai-reference-list', () => ({
  AIReferenceList: ({
    references,
    selectedIds,
    onSelectionChange,
  }: {
    references: AIDraftReference[];
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
  }) => (
    <div data-testid="ai-reference-list">
      <span data-testid="reference-count">{references.length}개 참조</span>
      {references.map((ref) => (
        <button
          key={ref.workId}
          type="button"
          data-testid={`reference-${ref.workId}`}
          onClick={() => {
            if (selectedIds.includes(ref.workId)) {
              onSelectionChange(selectedIds.filter((id) => id !== ref.workId));
            } else {
              onSelectionChange([...selectedIds, ref.workId]);
            }
          }}
        >
          {ref.title}
        </button>
      ))}
    </div>
  ),
}));

describe('DraftEditorForm', () => {
  const mockSetTitle = vi.fn();
  const mockSetContent = vi.fn();
  const mockSetSelectedPersonIds = vi.fn();
  const mockHandleCategoryToggle = vi.fn();
  const mockHandleRemoveTodo = vi.fn();
  const mockSetSelectedReferenceIds = vi.fn();
  const mockHandleSubmit = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnReset = vi.fn();

  const createState = (overrides: Partial<AIDraftFormState> = {}): AIDraftFormState => ({
    title: '',
    content: '',
    selectedCategoryIds: [],
    selectedPersonIds: [],
    suggestedTodos: [],
    references: [],
    selectedReferenceIds: [],
    isSubmitting: false,
    ...overrides,
  });

  const createActions = (): AIDraftFormActions => ({
    setTitle: mockSetTitle,
    setContent: mockSetContent,
    setSelectedCategoryIds: vi.fn(),
    setSelectedPersonIds: mockSetSelectedPersonIds,
    handleCategoryToggle: mockHandleCategoryToggle,
    handleRemoveTodo: mockHandleRemoveTodo,
    setSelectedReferenceIds: mockSetSelectedReferenceIds,
    handleSubmit: mockHandleSubmit,
    resetForm: vi.fn(),
    populateDraft: vi.fn(),
  });

  const categories = [
    createTaskCategory({ categoryId: 'cat-1', name: '일반', isActive: true }),
    createTaskCategory({ categoryId: 'cat-2', name: '긴급', isActive: true }),
  ];

  const persons = [
    createPerson({ personId: 'P001', name: '홍길동' }),
    createPerson({ personId: 'P002', name: '김철수' }),
  ];

  const createData = (overrides: Partial<AIDraftFormData> = {}): AIDraftFormData => ({
    taskCategories: categories,
    persons: persons,
    categoriesLoading: false,
    personsLoading: false,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleSubmit.mockImplementation((e: React.FormEvent) => {
      e.preventDefault();
      return Promise.resolve();
    });
  });

  describe('rendering', () => {
    it('renders form with title input', () => {
      render(
        <DraftEditorForm
          state={createState()}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByLabelText('제목')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('업무노트 제목을 입력하세요')).toBeInTheDocument();
    });

    it('renders form with content textarea', () => {
      render(
        <DraftEditorForm
          state={createState()}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByLabelText('내용')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('업무노트 내용을 입력하세요')).toBeInTheDocument();
    });

    it('renders category checkboxes', () => {
      render(
        <DraftEditorForm
          state={createState()}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('업무 구분 (선택사항)')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /일반/ })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /긴급/ })).toBeInTheDocument();
    });

    it('renders assignee selector', () => {
      render(
        <DraftEditorForm
          state={createState()}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('담당자 (선택사항)')).toBeInTheDocument();
      expect(screen.getByTestId('assignee-selector')).toBeInTheDocument();
    });

    it('renders AI reference list', () => {
      render(
        <DraftEditorForm
          state={createState({
            references: [
              { workId: 'ref-1', title: 'Reference 1', content: 'Content', similarityScore: 0.9 },
            ],
          })}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('ai-reference-list')).toBeInTheDocument();
    });

    it('renders cancel and submit buttons', () => {
      render(
        <DraftEditorForm
          state={createState()}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '업무노트 저장' })).toBeInTheDocument();
    });

    it('renders reset button when onReset is provided', () => {
      render(
        <DraftEditorForm
          state={createState()}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
          onReset={mockOnReset}
        />
      );

      expect(screen.getByRole('button', { name: '다시 입력' })).toBeInTheDocument();
    });

    it('renders custom reset label', () => {
      render(
        <DraftEditorForm
          state={createState()}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
          onReset={mockOnReset}
          resetLabel="초기화"
        />
      );

      expect(screen.getByRole('button', { name: '초기화' })).toBeInTheDocument();
    });
  });

  describe('loading states', () => {
    it('shows loading message when categories are loading', () => {
      render(
        <DraftEditorForm
          state={createState()}
          actions={createActions()}
          data={createData({ categoriesLoading: true, taskCategories: [] })}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('로딩 중...')).toBeInTheDocument();
    });

    it('shows empty message when no categories exist', () => {
      render(
        <DraftEditorForm
          state={createState()}
          actions={createActions()}
          data={createData({ taskCategories: [] })}
          onCancel={mockOnCancel}
        />
      );

      expect(
        screen.getByText('등록된 업무 구분이 없습니다. 먼저 업무 구분을 추가해주세요.')
      ).toBeInTheDocument();
    });

    it('shows empty message when no persons exist', () => {
      render(
        <DraftEditorForm
          state={createState()}
          actions={createActions()}
          data={createData({ persons: [] })}
          onCancel={mockOnCancel}
        />
      );

      expect(
        screen.getByText('등록된 사람이 없습니다. 먼저 사람을 추가해주세요.')
      ).toBeInTheDocument();
    });

    it('passes loading state to assignee selector', () => {
      render(
        <DraftEditorForm
          state={createState()}
          actions={createActions()}
          data={createData({ personsLoading: true })}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('담당자 로딩 중...')).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('calls setTitle when title input changes', async () => {
      const user = userEvent.setup();
      render(
        <DraftEditorForm
          state={createState()}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByLabelText('제목');
      await user.type(input, '새 제목');

      expect(mockSetTitle).toHaveBeenCalled();
    });

    it('calls setContent when content textarea changes', async () => {
      const user = userEvent.setup();
      render(
        <DraftEditorForm
          state={createState()}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
        />
      );

      const textarea = screen.getByLabelText('내용');
      await user.type(textarea, '새 내용');

      expect(mockSetContent).toHaveBeenCalled();
    });

    it('calls handleCategoryToggle when category checkbox is clicked', async () => {
      const user = userEvent.setup();
      render(
        <DraftEditorForm
          state={createState()}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
        />
      );

      const checkbox = screen.getByRole('checkbox', { name: /일반/ });
      await user.click(checkbox);

      expect(mockHandleCategoryToggle).toHaveBeenCalledWith('cat-1');
    });

    it('shows selected categories as checked', () => {
      render(
        <DraftEditorForm
          state={createState({ selectedCategoryIds: ['cat-1'] })}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('checkbox', { name: /일반/ })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: /긴급/ })).not.toBeChecked();
    });

    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <DraftEditorForm
          state={createState()}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByRole('button', { name: '취소' }));

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('calls onReset when reset button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <DraftEditorForm
          state={createState()}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
          onReset={mockOnReset}
        />
      );

      await user.click(screen.getByRole('button', { name: '다시 입력' }));

      expect(mockOnReset).toHaveBeenCalled();
    });
  });

  describe('form submission', () => {
    it('calls handleSubmit on form submit', async () => {
      const user = userEvent.setup();
      render(
        <DraftEditorForm
          state={createState({ title: '테스트 제목', content: '테스트 내용' })}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByRole('button', { name: '업무노트 저장' }));

      expect(mockHandleSubmit).toHaveBeenCalled();
    });

    it('shows submitting state on buttons', () => {
      render(
        <DraftEditorForm
          state={createState({ isSubmitting: true })}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
          onReset={mockOnReset}
        />
      );

      expect(screen.getByRole('button', { name: '저장 중...' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '다시 입력' })).toBeDisabled();
    });
  });

  describe('suggested todos', () => {
    const suggestedTodos: SuggestedTodo[] = [
      { uiId: 'todo-1', title: '할일 1', description: '설명 1', dueDate: '2024-12-31' },
      { uiId: 'todo-2', title: '할일 2', description: undefined, dueDate: undefined },
    ];

    it('renders suggested todos section when todos exist', () => {
      render(
        <DraftEditorForm
          state={createState({ suggestedTodos })}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('생성될 할일 (삭제 가능)')).toBeInTheDocument();
      expect(screen.getByText('할일 1')).toBeInTheDocument();
      expect(screen.getByText('할일 2')).toBeInTheDocument();
    });

    it('shows todo description when provided', () => {
      render(
        <DraftEditorForm
          state={createState({ suggestedTodos })}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('설명 1')).toBeInTheDocument();
    });

    it('shows todo due date when provided', () => {
      render(
        <DraftEditorForm
          state={createState({ suggestedTodos })}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('마감: 2024-12-31')).toBeInTheDocument();
    });

    it('does not render todos section when no todos exist', () => {
      render(
        <DraftEditorForm
          state={createState({ suggestedTodos: [] })}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByText('생성될 할일 (삭제 가능)')).not.toBeInTheDocument();
    });

    it('calls handleRemoveTodo when delete button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <DraftEditorForm
          state={createState({ suggestedTodos })}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
        />
      );

      // Find the first todo item and its delete button
      const todoItem = screen.getByText('할일 1').closest('li');
      const deleteButton = todoItem?.querySelector('button');

      expect(deleteButton).toBeInTheDocument();
      if (!deleteButton) {
        throw new Error('Delete button not found');
      }
      await user.click(deleteButton);

      expect(mockHandleRemoveTodo).toHaveBeenCalledWith('todo-1');
    });
  });

  describe('state display', () => {
    it('displays current title value', () => {
      render(
        <DraftEditorForm
          state={createState({ title: '기존 제목' })}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByLabelText('제목')).toHaveValue('기존 제목');
    });

    it('displays current content value', () => {
      render(
        <DraftEditorForm
          state={createState({ content: '기존 내용' })}
          actions={createActions()}
          data={createData()}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByLabelText('내용')).toHaveValue('기존 내용');
    });
  });
});
