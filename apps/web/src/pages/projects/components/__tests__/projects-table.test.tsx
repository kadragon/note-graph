import { createProject, resetFactoryCounter } from '@web/test/factories';
import { render, screen, within } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectsTable } from '../projects-table';

describe('ProjectsTable', () => {
  beforeEach(() => {
    resetFactoryCounter();
  });

  it('renders empty table body when no projects', () => {
    render(<ProjectsTable projects={[]} onView={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  describe('accessibility', () => {
    it('has aria-label on view button', () => {
      const project = createProject({ name: 'Test Project' });

      render(<ProjectsTable projects={[project]} onView={vi.fn()} onDelete={vi.fn()} />);

      const row = screen.getByRole('row', { name: /Test Project/ });
      const viewButton = within(row).getByRole('button', { name: /보기/ });
      expect(viewButton).toBeInTheDocument();
    });

    it('has aria-label on delete button', () => {
      const project = createProject({ name: 'Test Project' });

      render(<ProjectsTable projects={[project]} onView={vi.fn()} onDelete={vi.fn()} />);

      const row = screen.getByRole('row', { name: /Test Project/ });
      const deleteButton = within(row).getByRole('button', { name: /삭제/ });
      expect(deleteButton).toBeInTheDocument();
    });
  });
});
