import userEvent from '@testing-library/user-event';
import { useWorkNoteGroupWorkNotes } from '@web/hooks/use-work-note-groups';
import { createWorkNoteGroupWorkNote } from '@web/test/factories';
import { render, screen } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import WorkNoteGroupDetail from '../work-note-group-detail';

vi.mock('@web/hooks/use-work-note-groups', () => ({
  useWorkNoteGroupWorkNotes: vi.fn(),
}));

let mockParams: Record<string, string | undefined> = {};
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => mockParams,
    useNavigate: () => mockNavigate,
  };
});

describe('work-note-group-detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = { id: 'GRP-1' };
  });

  it('shows missing ID state when id param is absent', () => {
    mockParams = {};

    render(<WorkNoteGroupDetail />);

    expect(screen.getByText('업무 그룹 ID가 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '목록으로 돌아가기' })).toBeInTheDocument();
  });

  it('navigates to list when clicking back button on missing ID', async () => {
    mockParams = {};
    const user = userEvent.setup();

    render(<WorkNoteGroupDetail />);

    await user.click(screen.getByRole('button', { name: '목록으로 돌아가기' }));

    expect(mockNavigate).toHaveBeenCalledWith('/work-note-groups');
  });

  it('shows loading state', () => {
    vi.mocked(useWorkNoteGroupWorkNotes).mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
    } as unknown as ReturnType<typeof useWorkNoteGroupWorkNotes>);

    render(<WorkNoteGroupDetail />);

    expect(screen.getByText('로딩 중...')).toBeInTheDocument();
  });

  it('shows error state with retry and back buttons', async () => {
    const refetch = vi.fn();
    vi.mocked(useWorkNoteGroupWorkNotes).mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      refetch,
    } as unknown as ReturnType<typeof useWorkNoteGroupWorkNotes>);

    const user = userEvent.setup();
    render(<WorkNoteGroupDetail />);

    expect(screen.getByText('업무노트 목록을 불러오지 못했습니다.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '목록으로 돌아가기' }));
    expect(mockNavigate).toHaveBeenCalledWith('/work-note-groups');
  });

  it('shows empty state when no work notes', () => {
    vi.mocked(useWorkNoteGroupWorkNotes).mockReturnValue({
      isLoading: false,
      isError: false,
      data: [],
    } as unknown as ReturnType<typeof useWorkNoteGroupWorkNotes>);

    render(<WorkNoteGroupDetail />);

    expect(screen.getByText('연결된 업무노트가 없습니다.')).toBeInTheDocument();
  });

  it('renders work note list with correct links', () => {
    const workNotes = [
      createWorkNoteGroupWorkNote({ workId: 'WORK-1', title: '업무노트 A' }),
      createWorkNoteGroupWorkNote({ workId: 'WORK-2', title: '업무노트 B' }),
    ];
    vi.mocked(useWorkNoteGroupWorkNotes).mockReturnValue({
      isLoading: false,
      isError: false,
      data: workNotes,
    } as unknown as ReturnType<typeof useWorkNoteGroupWorkNotes>);

    render(<WorkNoteGroupDetail />);

    const linkA = screen.getByRole('link', { name: '업무노트 A' });
    expect(linkA).toHaveAttribute('href', '/work-notes/WORK-1');

    const linkB = screen.getByRole('link', { name: '업무노트 B' });
    expect(linkB).toHaveAttribute('href', '/work-notes/WORK-2');
  });

  it('navigates back when clicking the back button', async () => {
    vi.mocked(useWorkNoteGroupWorkNotes).mockReturnValue({
      isLoading: false,
      isError: false,
      data: [],
    } as unknown as ReturnType<typeof useWorkNoteGroupWorkNotes>);

    const user = userEvent.setup();
    render(<WorkNoteGroupDetail />);

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
