import { render, screen } from '@web/test/setup';
import { describe, expect, it, vi } from 'vitest';

import { type SortDirection, type SortKey, WorkNotesTable } from '../work-notes-table';

describe('WorkNotesTable', () => {
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
});
