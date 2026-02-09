import userEvent from '@testing-library/user-event';
import { createPerson, createTaskCategory } from '@web/test/factories';
import { render, screen } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkNoteEditForm } from '../work-note-edit-form';

vi.mock('@web/components/assignee-selector', () => ({
  AssigneeSelector: ({
    selectedPersonIds,
    onSelectionChange,
  }: {
    selectedPersonIds: string[];
    onSelectionChange: (ids: string[]) => void;
  }) => (
    <div data-testid="assignee-selector">
      <span>Selected: {selectedPersonIds.length}</span>
      <button type="button" onClick={() => onSelectionChange(['person-1'])}>
        Select Person
      </button>
    </div>
  ),
}));

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

describe('WorkNoteEditForm', () => {
  const mockOnChange = vi.fn();
  const defaultProps = {
    title: '테스트 제목',
    content: '테스트 내용',
    categoryIds: [] as string[],
    personIds: [] as string[],
    categories: [createTaskCategory({ categoryId: 'cat-1', name: '기본', isActive: true })],
    persons: [createPerson({ personId: 'person-1', name: '홍길동' })],
    onChange: mockOnChange,
    categoriesLoading: false,
    personsLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields', () => {
    render(<WorkNoteEditForm {...defaultProps} />);

    expect(screen.getByPlaceholderText('제목')).toHaveValue('테스트 제목');
    expect(screen.getByText('업무 구분')).toBeInTheDocument();
    expect(screen.getByText('담당자')).toBeInTheDocument();
  });

  it('renders basic and content tabs for edit UX', () => {
    render(<WorkNoteEditForm {...defaultProps} />);

    expect(screen.getByRole('tab', { name: '기본 정보' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '내용' })).toBeInTheDocument();
  });

  it('calls onChange when title changes', async () => {
    const user = userEvent.setup();
    render(<WorkNoteEditForm {...defaultProps} title="" />);

    const titleInput = screen.getByPlaceholderText('제목');
    await user.type(titleInput, 'A');

    expect(mockOnChange).toHaveBeenCalledWith('title', 'A');
  });

  it('calls onChange when content changes', async () => {
    const user = userEvent.setup();
    render(<WorkNoteEditForm {...defaultProps} content="" />);

    await user.click(screen.getByRole('tab', { name: '내용' }));
    const contentInput = screen.getByPlaceholderText('마크다운 형식으로 작성하세요');
    await user.type(contentInput, 'B');

    expect(mockOnChange).toHaveBeenCalledWith('content', 'B');
  });

  it('renders categories as checkboxes', () => {
    render(<WorkNoteEditForm {...defaultProps} />);

    expect(screen.getByRole('checkbox', { name: /기본/ })).toBeInTheDocument();
  });

  it('calls onChange when category is toggled', async () => {
    const user = userEvent.setup();
    render(<WorkNoteEditForm {...defaultProps} />);

    const checkbox = screen.getByRole('checkbox', { name: /기본/ });
    await user.click(checkbox);

    expect(mockOnChange).toHaveBeenCalledWith('categoryIds', ['cat-1']);
  });

  it('shows selected categories as checked', () => {
    render(<WorkNoteEditForm {...defaultProps} categoryIds={['cat-1']} />);

    expect(screen.getByRole('checkbox', { name: /기본/ })).toBeChecked();
  });

  it('renders assignee selector', () => {
    render(<WorkNoteEditForm {...defaultProps} />);

    expect(screen.getByTestId('assignee-selector')).toBeInTheDocument();
  });

  it('calls onChange when assignee selection changes', async () => {
    const user = userEvent.setup();
    render(<WorkNoteEditForm {...defaultProps} />);

    await user.click(screen.getByText('Select Person'));

    expect(mockOnChange).toHaveBeenCalledWith('personIds', ['person-1']);
  });

  it('shows loading state for categories', () => {
    render(<WorkNoteEditForm {...defaultProps} categoriesLoading={true} />);

    expect(screen.getByText('로딩 중...')).toBeInTheDocument();
  });

  it('shows message when no categories available', () => {
    render(<WorkNoteEditForm {...defaultProps} categories={[]} />);

    expect(screen.getByText('등록된 업무 구분이 없습니다.')).toBeInTheDocument();
  });

  it('shows inactive categories with disabled state when not selected', () => {
    const inactiveCategory = createTaskCategory({
      categoryId: 'cat-inactive',
      name: '레거시',
      isActive: false,
    });
    render(<WorkNoteEditForm {...defaultProps} categories={[inactiveCategory]} />);

    const checkbox = screen.getByRole('checkbox', { name: /레거시/ });
    expect(checkbox).toBeDisabled();
    expect(screen.getByText('(비활성)')).toBeInTheDocument();
  });

  it('keeps inactive category enabled when already selected', () => {
    const inactiveCategory = createTaskCategory({
      categoryId: 'cat-inactive',
      name: '레거시',
      isActive: false,
    });
    render(
      <WorkNoteEditForm
        {...defaultProps}
        categories={[inactiveCategory]}
        categoryIds={['cat-inactive']}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: /레거시/ });
    expect(checkbox).not.toBeDisabled();
    expect(checkbox).toBeChecked();
  });

  describe('accessibility', () => {
    it('has aria-label on title input', () => {
      render(<WorkNoteEditForm {...defaultProps} />);

      const titleInput = screen.getByRole('textbox', { name: /제목/ });
      expect(titleInput).toBeInTheDocument();
    });
  });
});
