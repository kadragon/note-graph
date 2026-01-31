import userEvent from '@testing-library/user-event';
import { createTaskCategory } from '@web/test/factories';
import { render, screen } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CategorySelector } from '../category-selector';

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

describe('CategorySelector', () => {
  const mockOnSelectionChange = vi.fn();
  const categories = [
    createTaskCategory({ categoryId: 'cat-1', name: '일반', isActive: true }),
    createTaskCategory({ categoryId: 'cat-2', name: '긴급', isActive: true }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders categories as checkboxes', () => {
    render(
      <CategorySelector
        categories={categories}
        selectedIds={[]}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    expect(screen.getByRole('checkbox', { name: /일반/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /긴급/ })).toBeInTheDocument();
  });

  it('shows selected categories as checked', () => {
    render(
      <CategorySelector
        categories={categories}
        selectedIds={['cat-1']}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    expect(screen.getByRole('checkbox', { name: /일반/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /긴급/ })).not.toBeChecked();
  });

  it('calls onSelectionChange when category is selected', async () => {
    const user = userEvent.setup();
    render(
      <CategorySelector
        categories={categories}
        selectedIds={[]}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    await user.click(screen.getByRole('checkbox', { name: /일반/ }));

    expect(mockOnSelectionChange).toHaveBeenCalledWith(['cat-1']);
  });

  it('calls onSelectionChange when category is deselected', async () => {
    const user = userEvent.setup();
    render(
      <CategorySelector
        categories={categories}
        selectedIds={['cat-1', 'cat-2']}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    await user.click(screen.getByRole('checkbox', { name: /일반/ }));

    expect(mockOnSelectionChange).toHaveBeenCalledWith(['cat-2']);
  });

  it('shows loading state', () => {
    render(
      <CategorySelector
        categories={[]}
        selectedIds={[]}
        onSelectionChange={mockOnSelectionChange}
        isLoading={true}
      />
    );

    expect(screen.getByText('로딩 중...')).toBeInTheDocument();
  });

  it('shows empty state when no categories', () => {
    render(
      <CategorySelector
        categories={[]}
        selectedIds={[]}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    expect(screen.getByText('등록된 업무 구분이 없습니다.')).toBeInTheDocument();
  });

  it('shows inactive categories with disabled state when not selected', () => {
    const inactiveCategory = createTaskCategory({
      categoryId: 'cat-inactive',
      name: '레거시',
      isActive: false,
    });
    render(
      <CategorySelector
        categories={[inactiveCategory]}
        selectedIds={[]}
        onSelectionChange={mockOnSelectionChange}
      />
    );

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
      <CategorySelector
        categories={[inactiveCategory]}
        selectedIds={['cat-inactive']}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: /레거시/ });
    expect(checkbox).not.toBeDisabled();
    expect(checkbox).toBeChecked();
  });

  it('supports custom id prefix', () => {
    render(
      <CategorySelector
        categories={categories}
        selectedIds={[]}
        onSelectionChange={mockOnSelectionChange}
        idPrefix="custom"
      />
    );

    expect(document.getElementById('custom-cat-1')).toBeInTheDocument();
  });
});
