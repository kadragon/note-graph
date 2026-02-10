import { createWorkNoteWithStats, resetFactoryCounter } from '@web/test/factories';
import { render, screen, within } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type SortDirection, type SortKey, WorkNotesTable } from '../work-notes-table';

describe('WorkNotesTable', () => {
  beforeEach(() => {
    resetFactoryCounter();
  });

  it('renders empty state message when no work notes are available', () => {
    const sortKey: SortKey = 'createdAt';
    const sortDirection: SortDirection = 'asc';

    render(
      <WorkNotesTable
        workNotes={[]}
        onView={vi.fn()}
        onDelete={vi.fn()}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={vi.fn()}
      />
    );

    expect(screen.getByText('업무노트가 없습니다.')).toBeInTheDocument();
  });

  describe('accessibility', () => {
    it('has accessible name on download button', () => {
      const workNote = createWorkNoteWithStats({ title: 'Test Note' });

      render(
        <WorkNotesTable
          workNotes={[workNote]}
          onView={vi.fn()}
          onDelete={vi.fn()}
          sortKey="createdAt"
          sortDirection="asc"
          onSort={vi.fn()}
        />
      );

      const row = screen.getByRole('row', { name: /Test Note/ });
      const downloadButton = within(row).getByRole('button', { name: /다운로드/ });
      expect(downloadButton).toBeInTheDocument();
    });

    it('has accessible name on delete button', () => {
      const workNote = createWorkNoteWithStats({ title: 'Test Note' });

      render(
        <WorkNotesTable
          workNotes={[workNote]}
          onView={vi.fn()}
          onDelete={vi.fn()}
          sortKey="createdAt"
          sortDirection="asc"
          onSort={vi.fn()}
        />
      );

      const row = screen.getByRole('row', { name: /Test Note/ });
      const deleteButton = within(row).getByRole('button', { name: /삭제/ });
      expect(deleteButton).toBeInTheDocument();
    });
  });

  it('renders assignee as affiliation/name without contact info', () => {
    const workNote = createWorkNoteWithStats({
      title: 'Test Note',
      persons: [
        {
          personId: 'P001',
          personName: '홍길동',
          role: 'OWNER',
          currentDept: '개발팀',
          phoneExt: '3346',
        },
      ],
    });

    render(
      <WorkNotesTable
        workNotes={[workNote]}
        onView={vi.fn()}
        onDelete={vi.fn()}
        sortKey="createdAt"
        sortDirection="asc"
        onSort={vi.fn()}
      />
    );

    const row = screen.getByRole('row', { name: /Test Note/ });
    expect(within(row).getByText('개발팀/홍길동')).toBeInTheDocument();
    expect(within(row).queryByText(/3346/)).not.toBeInTheDocument();
  });
});
