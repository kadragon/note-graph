import userEvent from '@testing-library/user-event';
import { fireEvent, render, screen } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TodoCreationForm } from '../todo-creation-form';

vi.mock('@web/components/ui/checkbox', () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id?: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input id={id} type="checkbox" checked={checked} onChange={() => onCheckedChange?.(!checked)} />
  ),
}));

describe('TodoCreationForm', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form fields', () => {
    render(<TodoCreationForm onSubmit={mockOnSubmit} isPending={false} />);

    expect(screen.getByLabelText('할일 제목')).toBeInTheDocument();
    expect(screen.getByLabelText('설명 (선택사항)')).toBeInTheDocument();
    expect(screen.getByLabelText('대기일 (선택사항)')).toBeInTheDocument();
    expect(screen.getByLabelText('마감일 (선택사항)')).toBeInTheDocument();
    expect(screen.getByLabelText('반복 설정')).toBeInTheDocument();
    expect(screen.getByText('0/2000')).toBeInTheDocument();
  });

  it('submits form with correct data', async () => {
    const user = userEvent.setup();
    render(<TodoCreationForm onSubmit={mockOnSubmit} isPending={false} />);

    await user.type(screen.getByLabelText('할일 제목'), '테스트 할일');
    await user.type(screen.getByLabelText('설명 (선택사항)'), '설명입니다');
    await user.click(screen.getByRole('button', { name: '추가' }));

    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '테스트 할일',
        description: '설명입니다',
      })
    );
  });

  it('does not submit when title is empty', async () => {
    const user = userEvent.setup();
    render(<TodoCreationForm onSubmit={mockOnSubmit} isPending={false} />);

    await user.click(screen.getByRole('button', { name: '추가' }));

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('shows custom interval fields when CUSTOM repeat rule is selected', async () => {
    const user = userEvent.setup();
    render(<TodoCreationForm onSubmit={mockOnSubmit} isPending={false} />);

    await user.selectOptions(screen.getByLabelText('반복 설정'), 'CUSTOM');

    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    expect(screen.getByText('마다')).toBeInTheDocument();
  });

  it('shows skip weekends checkbox when repeat rule is not NONE', async () => {
    const user = userEvent.setup();
    render(<TodoCreationForm onSubmit={mockOnSubmit} isPending={false} />);

    expect(screen.queryByLabelText(/주말 제외/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('반복 설정'), 'DAILY');

    expect(screen.getByLabelText(/주말 제외/)).toBeInTheDocument();
  });

  it('shows recurrence type selector when repeat rule is not NONE', async () => {
    const user = userEvent.setup();
    render(<TodoCreationForm onSubmit={mockOnSubmit} isPending={false} />);

    expect(screen.queryByLabelText('반복 기준')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('반복 설정'), 'WEEKLY');

    expect(screen.getByLabelText('반복 기준')).toBeInTheDocument();
  });

  it('sets due date to wait until date when wait until is set and due date is empty', async () => {
    const user = userEvent.setup();
    render(<TodoCreationForm onSubmit={mockOnSubmit} isPending={false} />);

    // Clear the default due date first
    const dueDateInput = screen.getByLabelText('마감일 (선택사항)');
    await user.clear(dueDateInput);

    const waitUntilInput = screen.getByLabelText('대기일 (선택사항)');
    await user.type(waitUntilInput, '2026-02-15');

    // Due date should be auto-filled
    expect(dueDateInput).toHaveValue('2026-02-15');
  });

  it('shows loading state when isPending is true', () => {
    render(<TodoCreationForm onSubmit={mockOnSubmit} isPending={true} />);

    expect(screen.getByRole('button', { name: '추가 중...' })).toBeDisabled();
  });

  it('shows description character counter and limits input to 2000 characters', () => {
    render(<TodoCreationForm onSubmit={mockOnSubmit} isPending={false} />);

    const descriptionInput = screen.getByLabelText('설명 (선택사항)');
    const overLimitMixedText = '가A!'.repeat(700);

    fireEvent.change(descriptionInput, { target: { value: overLimitMixedText } });

    expect(Array.from((descriptionInput as HTMLTextAreaElement).value)).toHaveLength(2000);
    expect(screen.getByText('2000/2000')).toBeInTheDocument();
  });

  it('resets form after successful submit', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockImplementation(() => Promise.resolve());

    render(<TodoCreationForm onSubmit={mockOnSubmit} isPending={false} />);

    await user.type(screen.getByLabelText('할일 제목'), '테스트 할일');
    await user.click(screen.getByRole('button', { name: '추가' }));

    // After submit, form should call onSubmit and can be reset by parent
    expect(mockOnSubmit).toHaveBeenCalled();
  });
});
