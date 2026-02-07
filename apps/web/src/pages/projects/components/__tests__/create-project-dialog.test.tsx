import { usePersons } from '@web/hooks/use-persons';
import { createPerson } from '@web/test/factories';
import { render, screen } from '@web/test/setup';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateProjectDialog } from '../create-project-dialog';

vi.mock('@web/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@web/components/ui/select', () => ({
  Select: ({ value, children }: { value?: string; children: ReactNode }) => (
    <div data-testid="select-root" data-value={value === undefined ? '__undefined__' : value}>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ id, children }: { id?: string; children: ReactNode }) => (
    <button type="button" id={id}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

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

vi.mock('@web/hooks/use-persons', () => ({
  usePersons: vi.fn(() => ({ data: [createPerson()] })),
}));

vi.mock('@web/hooks/use-departments', () => ({
  useDepartments: vi.fn(() => ({ data: [] })),
}));

vi.mock('@web/hooks/use-projects', () => ({
  useCreateProject: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

describe('CreateProjectDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('accessibility', () => {
    it('has aria-label on participant search input', () => {
      render(<CreateProjectDialog {...defaultProps} />);

      const searchInput = screen.getByRole('textbox', { name: /참여자 검색/ });
      expect(searchInput).toBeInTheDocument();
    });

    it('sets start date default value to today', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-07T10:00:00'));

      render(<CreateProjectDialog {...defaultProps} />);

      expect(screen.getByLabelText('시작일')).toHaveValue('2026-02-07');

      vi.useRealTimers();
    });
  });

  describe('select values', () => {
    it('keeps all Select components controlled on initial render', () => {
      render(<CreateProjectDialog {...defaultProps} />);

      const selectRoots = screen.getAllByTestId('select-root');
      expect(selectRoots).toHaveLength(2);

      for (const selectRoot of selectRoots) {
        expect(selectRoot).not.toHaveAttribute('data-value', '__undefined__');
      }
    });
  });

  describe('participants', () => {
    it('renders participants as department/name format in list', () => {
      vi.mocked(usePersons).mockReturnValue({
        data: [createPerson({ personId: '123456', name: '홍길동', currentDept: '개발부' })],
      } as unknown as ReturnType<typeof usePersons>);

      render(<CreateProjectDialog {...defaultProps} />);

      expect(screen.getByText('개발부/홍길동')).toBeInTheDocument();
    });
  });

  describe('layout', () => {
    it('keeps dialog wrapper non-scrollable and uses form column layout', () => {
      render(<CreateProjectDialog {...defaultProps} />);

      expect(screen.getByTestId('dialog-content')).toHaveClass('overflow-hidden');
      const submitButton = screen.getByRole('button', { name: '생성' });
      expect(submitButton.closest('form')).toHaveClass('flex', 'min-h-0', 'flex-col');
    });
  });
});
