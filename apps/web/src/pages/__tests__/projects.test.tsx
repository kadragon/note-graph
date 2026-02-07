import userEvent from '@testing-library/user-event';
import { usePersons } from '@web/hooks/use-persons';
import { useDeleteProject, useProjects } from '@web/hooks/use-projects';
import { createProject, resetFactoryCounter } from '@web/test/factories';
import { render, screen, waitFor } from '@web/test/setup';
import type { Project } from '@web/types/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Projects from '../projects';

vi.mock('@web/hooks/use-projects', () => ({
  useProjects: vi.fn(),
  useDeleteProject: vi.fn(),
}));

vi.mock('@web/hooks/use-persons', () => ({
  usePersons: vi.fn(),
}));

vi.mock('../projects/components/projects-table', () => ({
  ProjectsTable: ({
    projects,
    onDelete,
  }: {
    projects: Project[];
    onDelete: (projectId: string) => void;
  }) => (
    <div data-testid="projects-table">
      {projects.map((project) => (
        <button key={project.projectId} type="button" onClick={() => onDelete(project.projectId)}>
          delete-{project.projectId}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../projects/components/create-project-dialog', () => ({
  CreateProjectDialog: ({ open }: { open: boolean }) => (
    <div data-testid="create-project-dialog" data-open={open ? 'true' : 'false'} />
  ),
}));

vi.mock('../projects/components/project-detail-dialog', () => ({
  ProjectDetailDialog: ({ open }: { open: boolean }) => (
    <div data-testid="project-detail-dialog" data-open={open ? 'true' : 'false'} />
  ),
}));

describe('projects page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
    vi.mocked(usePersons).mockReturnValue({ data: [] } as unknown as ReturnType<typeof usePersons>);
    vi.mocked(useDeleteProject).mockReturnValue({
      mutateAsync: vi.fn(),
    } as unknown as ReturnType<typeof useDeleteProject>);
  });

  it('shows empty state when there are no projects', () => {
    vi.mocked(useProjects).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useProjects>);

    render(<Projects />);

    expect(
      screen.getByText('프로젝트가 없습니다. 새 프로젝트를 만들어보세요.')
    ).toBeInTheDocument();
  });

  it('shows only status/year filters and hides the page description', () => {
    vi.mocked(useProjects).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useProjects>);

    render(<Projects />);

    expect(screen.getByText('상태')).toBeInTheDocument();
    expect(screen.getByText('년도')).toBeInTheDocument();
    expect(screen.queryByText('시작일 이후')).not.toBeInTheDocument();
    expect(screen.queryByText('시작일 이전')).not.toBeInTheDocument();
    expect(screen.queryByText('프로젝트를 관리하세요')).not.toBeInTheDocument();
  });

  it('converts year filter into startDateFrom/startDateTo query params', async () => {
    vi.mocked(useProjects).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useProjects>);
    const user = userEvent.setup();

    render(<Projects />);
    await user.type(screen.getByRole('spinbutton', { name: '년도' }), '2026');

    await waitFor(() => {
      expect(vi.mocked(useProjects)).toHaveBeenLastCalledWith({
        status: undefined,
        startDateFrom: '2026-01-01',
        startDateTo: '2026-12-31',
      });
    });
  });

  it('confirms deletion and calls the delete mutation', async () => {
    const project = createProject({ projectId: 'PROJECT-DELETE' });
    const mutateAsync = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useDeleteProject).mockReturnValue({
      mutateAsync,
    } as unknown as ReturnType<typeof useDeleteProject>);
    vi.mocked(useProjects).mockReturnValue({
      data: [project],
      isLoading: false,
    } as unknown as ReturnType<typeof useProjects>);

    const user = userEvent.setup();
    render(<Projects />);

    await user.click(screen.getByRole('button', { name: 'delete-PROJECT-DELETE' }));

    expect(screen.getByText('프로젝트 삭제')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '삭제' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith('PROJECT-DELETE');
    });
  });
});
