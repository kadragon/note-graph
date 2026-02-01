import userEvent from '@testing-library/user-event';
import { createPerson } from '@web/test/factories';
import { render, screen } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssigneeSelector } from '../assignee-selector';

// Mock Popover to render trigger + content directly for testing
vi.mock('@web/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? children : <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

// Mock Command to render as simple elements for testing
vi.mock('@web/components/ui/command', () => ({
  Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandInput: ({ placeholder }: { placeholder?: string }) => (
    <input placeholder={placeholder} aria-label="search" />
  ),
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandItem: ({
    children,
    onSelect,
    value,
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
    value?: string;
  }) => (
    <div role="option" data-value={value} onClick={onSelect} onKeyDown={onSelect} tabIndex={0}>
      {children}
    </div>
  ),
}));

describe('AssigneeSelector', () => {
  const mockOnSelectionChange = vi.fn();
  const persons = [
    createPerson({
      personId: 'P001',
      name: '홍길동',
      currentDept: '개발팀',
      currentPosition: '과장',
    }),
    createPerson({
      personId: 'P002',
      name: '김철수',
      currentDept: '기획팀',
      currentPosition: '대리',
    }),
    createPerson({ personId: 'P003', name: '이영희', currentDept: null, currentPosition: null }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders trigger button with placeholder when no selection', () => {
    render(
      <AssigneeSelector
        persons={persons}
        selectedPersonIds={[]}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('담당자 검색...')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <AssigneeSelector
        persons={[]}
        selectedPersonIds={[]}
        onSelectionChange={mockOnSelectionChange}
        isLoading={true}
      />
    );

    expect(screen.getByText('로딩 중...')).toBeInTheDocument();
  });

  it('disables button when disabled prop is true', () => {
    render(
      <AssigneeSelector
        persons={persons}
        selectedPersonIds={[]}
        onSelectionChange={mockOnSelectionChange}
        disabled={true}
      />
    );

    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('shows selected count in button', () => {
    render(
      <AssigneeSelector
        persons={persons}
        selectedPersonIds={['P001', 'P002']}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    expect(screen.getByText('2명 선택됨')).toBeInTheDocument();
  });

  it('renders selected persons as badges', () => {
    render(
      <AssigneeSelector
        persons={persons}
        selectedPersonIds={['P001']}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    // Badge contains formatted person info (dept/position/name/id)
    expect(screen.getByText(/개발팀\/과장\/홍길동\/P001/)).toBeInTheDocument();
  });

  it('calls onSelectionChange when removing a person via badge X button', async () => {
    const user = userEvent.setup();
    render(
      <AssigneeSelector
        persons={persons}
        selectedPersonIds={['P001', 'P002']}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    const removeButton = screen.getByRole('button', { name: /홍길동 제거/ });
    await user.click(removeButton);

    expect(mockOnSelectionChange).toHaveBeenCalledWith(['P002']);
  });

  it('disables badge remove button when disabled', () => {
    render(
      <AssigneeSelector
        persons={persons}
        selectedPersonIds={['P001']}
        onSelectionChange={mockOnSelectionChange}
        disabled={true}
      />
    );

    const removeButton = screen.getByRole('button', { name: /홍길동 제거/ });
    expect(removeButton).toBeDisabled();
  });

  it('calls onSelectionChange when selecting a person from list', async () => {
    const user = userEvent.setup();
    render(
      <AssigneeSelector
        persons={persons}
        selectedPersonIds={[]}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    const option = screen.getByRole('option', { name: /홍길동/ });
    await user.click(option);

    expect(mockOnSelectionChange).toHaveBeenCalledWith(['P001']);
  });

  it('calls onSelectionChange when deselecting a person from list', async () => {
    const user = userEvent.setup();
    render(
      <AssigneeSelector
        persons={persons}
        selectedPersonIds={['P001']}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    const option = screen.getByRole('option', { name: /홍길동/ });
    await user.click(option);

    expect(mockOnSelectionChange).toHaveBeenCalledWith([]);
  });

  it('renders person details in list items', () => {
    render(
      <AssigneeSelector
        persons={persons}
        selectedPersonIds={[]}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    // List items show name and details (id, dept, position)
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent('홍길동');
    expect(options[0]).toHaveTextContent('P001');
    expect(options[0]).toHaveTextContent('개발팀');
    expect(options[0]).toHaveTextContent('과장');
  });
});
