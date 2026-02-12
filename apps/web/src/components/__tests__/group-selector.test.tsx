import userEvent from '@testing-library/user-event';
import { createWorkNoteGroup } from '@web/test/factories';
import { render, screen } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GroupSelector } from '../group-selector';

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

describe('GroupSelector', () => {
  const mockOnSelectionChange = vi.fn();
  const groups = [
    createWorkNoteGroup({ groupId: 'grp-1', name: '프로젝트 A', isActive: true }),
    createWorkNoteGroup({ groupId: 'grp-2', name: '프로젝트 B', isActive: true }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders groups as checkboxes', () => {
    render(
      <GroupSelector groups={groups} selectedIds={[]} onSelectionChange={mockOnSelectionChange} />
    );

    expect(screen.getByRole('checkbox', { name: /프로젝트 A/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /프로젝트 B/ })).toBeInTheDocument();
  });

  it('calls onSelectionChange when group is toggled', async () => {
    const user = userEvent.setup();
    render(
      <GroupSelector groups={groups} selectedIds={[]} onSelectionChange={mockOnSelectionChange} />
    );

    await user.click(screen.getByRole('checkbox', { name: /프로젝트 A/ }));

    expect(mockOnSelectionChange).toHaveBeenCalledWith(['grp-1']);
  });

  it('shows empty state when no groups', () => {
    render(
      <GroupSelector groups={[]} selectedIds={[]} onSelectionChange={mockOnSelectionChange} />
    );

    expect(screen.getByText('등록된 업무 그룹이 없습니다.')).toBeInTheDocument();
  });
});
