import userEvent from '@testing-library/user-event';
import { render, screen } from '@web/test/setup';
import type { AIDraftReference } from '@web/types/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AIReferenceList } from '../ai-reference-list';

vi.mock('@web/components/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    className,
  }: {
    checked?: boolean;
    onCheckedChange?: () => void;
    className?: string;
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={() => onCheckedChange?.()}
      className={className}
      aria-label="reference checkbox"
    />
  ),
}));

function createReference(overrides: Partial<AIDraftReference> = {}): AIDraftReference {
  return {
    workId: `work-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Reference',
    content: 'Test content',
    similarityScore: 0.85,
    ...overrides,
  };
}

describe('AIReferenceList', () => {
  const mockOnSelectionChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no references', () => {
    render(
      <AIReferenceList references={[]} selectedIds={[]} onSelectionChange={mockOnSelectionChange} />
    );

    expect(screen.getByText('유사한 업무노트가 없습니다')).toBeInTheDocument();
    expect(screen.getByText('새로운 내용의 업무노트입니다')).toBeInTheDocument();
  });

  it('renders reference items with title and similarity score', () => {
    const references = [
      createReference({ workId: 'work-1', title: '회의록 작성', similarityScore: 0.92 }),
      createReference({ workId: 'work-2', title: '프로젝트 계획', similarityScore: 0.75 }),
    ];

    render(
      <AIReferenceList
        references={references}
        selectedIds={[]}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    expect(screen.getByText('회의록 작성')).toBeInTheDocument();
    expect(screen.getByText('프로젝트 계획')).toBeInTheDocument();
    expect(screen.getByText('연관도 92%')).toBeInTheDocument();
    expect(screen.getByText('연관도 75%')).toBeInTheDocument();
  });

  it('renders category when provided', () => {
    const references = [createReference({ category: '일반' })];

    render(
      <AIReferenceList
        references={references}
        selectedIds={[]}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    expect(screen.getByText('카테고리: 일반')).toBeInTheDocument();
  });

  it('shows N/A when similarity score is undefined', () => {
    const references = [createReference({ similarityScore: undefined as unknown as number })];

    render(
      <AIReferenceList
        references={references}
        selectedIds={[]}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    expect(screen.getByText('연관도 N/A')).toBeInTheDocument();
  });

  it('shows selected references as checked', () => {
    const references = [
      createReference({ workId: 'work-1', title: 'First' }),
      createReference({ workId: 'work-2', title: 'Second' }),
    ];

    render(
      <AIReferenceList
        references={references}
        selectedIds={['work-1']}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it('calls onSelectionChange when reference is selected', async () => {
    const user = userEvent.setup();
    const references = [createReference({ workId: 'work-1' })];

    render(
      <AIReferenceList
        references={references}
        selectedIds={[]}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    await user.click(screen.getByRole('checkbox'));

    expect(mockOnSelectionChange).toHaveBeenCalledWith(['work-1']);
  });

  it('calls onSelectionChange when reference is deselected', async () => {
    const user = userEvent.setup();
    const references = [
      createReference({ workId: 'work-1' }),
      createReference({ workId: 'work-2' }),
    ];

    render(
      <AIReferenceList
        references={references}
        selectedIds={['work-1', 'work-2']}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);

    expect(mockOnSelectionChange).toHaveBeenCalledWith(['work-2']);
  });

  it('shows helper text when references exist', () => {
    const references = [createReference()];

    render(
      <AIReferenceList
        references={references}
        selectedIds={[]}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    expect(
      screen.getByText('필요 없는 참고 자료는 선택 해제하세요. 해제된 항목은 저장되지 않습니다.')
    ).toBeInTheDocument();
  });

  it('does not show helper text when empty', () => {
    render(
      <AIReferenceList references={[]} selectedIds={[]} onSelectionChange={mockOnSelectionChange} />
    );

    expect(
      screen.queryByText('필요 없는 참고 자료는 선택 해제하세요. 해제된 항목은 저장되지 않습니다.')
    ).not.toBeInTheDocument();
  });

  describe('show all toggle', () => {
    it('does not show toggle button when references <= initialDisplayCount', () => {
      const references = Array.from({ length: 5 }, (_, i) =>
        createReference({ workId: `work-${i}`, title: `Reference ${i}` })
      );

      render(
        <AIReferenceList
          references={references}
          selectedIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      expect(screen.queryByRole('button', { name: /모두 보기/ })).not.toBeInTheDocument();
    });

    it('shows toggle button when references > initialDisplayCount', () => {
      const references = Array.from({ length: 7 }, (_, i) =>
        createReference({ workId: `work-${i}`, title: `Reference ${i}` })
      );

      render(
        <AIReferenceList
          references={references}
          selectedIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      expect(screen.getByRole('button', { name: '모두 보기 (7)' })).toBeInTheDocument();
    });

    it('shows only initialDisplayCount items by default', () => {
      const references = Array.from({ length: 7 }, (_, i) =>
        createReference({ workId: `work-${i}`, title: `Reference ${i}` })
      );

      render(
        <AIReferenceList
          references={references}
          selectedIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Default initialDisplayCount is 5
      expect(screen.getByText('Reference 0')).toBeInTheDocument();
      expect(screen.getByText('Reference 4')).toBeInTheDocument();
      expect(screen.queryByText('Reference 5')).not.toBeInTheDocument();
      expect(screen.queryByText('Reference 6')).not.toBeInTheDocument();
    });

    it('shows all items when toggle button is clicked', async () => {
      const user = userEvent.setup();
      const references = Array.from({ length: 7 }, (_, i) =>
        createReference({ workId: `work-${i}`, title: `Reference ${i}` })
      );

      render(
        <AIReferenceList
          references={references}
          selectedIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      await user.click(screen.getByRole('button', { name: '모두 보기 (7)' }));

      expect(screen.getByText('Reference 5')).toBeInTheDocument();
      expect(screen.getByText('Reference 6')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '간략히 보기' })).toBeInTheDocument();
    });

    it('collapses items when toggle button is clicked again', async () => {
      const user = userEvent.setup();
      const references = Array.from({ length: 7 }, (_, i) =>
        createReference({ workId: `work-${i}`, title: `Reference ${i}` })
      );

      render(
        <AIReferenceList
          references={references}
          selectedIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      await user.click(screen.getByRole('button', { name: '모두 보기 (7)' }));
      await user.click(screen.getByRole('button', { name: '간략히 보기' }));

      expect(screen.queryByText('Reference 5')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '모두 보기 (7)' })).toBeInTheDocument();
    });

    it('respects custom initialDisplayCount', () => {
      const references = Array.from({ length: 5 }, (_, i) =>
        createReference({ workId: `work-${i}`, title: `Reference ${i}` })
      );

      render(
        <AIReferenceList
          references={references}
          selectedIds={[]}
          onSelectionChange={mockOnSelectionChange}
          initialDisplayCount={3}
        />
      );

      expect(screen.getByText('Reference 0')).toBeInTheDocument();
      expect(screen.getByText('Reference 2')).toBeInTheDocument();
      expect(screen.queryByText('Reference 3')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '모두 보기 (5)' })).toBeInTheDocument();
    });
  });

  it('renders label', () => {
    render(
      <AIReferenceList references={[]} selectedIds={[]} onSelectionChange={mockOnSelectionChange} />
    );

    expect(screen.getByText('AI가 참고한 업무노트')).toBeInTheDocument();
  });
});
