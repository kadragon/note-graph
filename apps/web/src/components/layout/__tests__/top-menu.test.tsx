import userEvent from '@testing-library/user-event';
import { useAuth } from '@web/contexts/auth-context';
import { toast } from '@web/hooks/use-toast';
import { useGoogleDriveConfigStatus } from '@web/hooks/use-work-notes';
import { API } from '@web/lib/api';
import { render, screen } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TopMenu from '../top-menu';

vi.mock('@web/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@web/hooks/use-work-notes', () => ({
  useGoogleDriveConfigStatus: vi.fn(),
}));

vi.mock('@web/lib/api', () => ({
  API: {
    disconnectGoogle: vi.fn(),
  },
}));

vi.mock('@web/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}));

describe('top-menu', () => {
  const mockSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
    vi.mocked(useAuth).mockReturnValue({
      signOut: mockSignOut,
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: true,
      data: { connected: true },
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);
  });

  it('renders main navigation links', () => {
    render(<TopMenu />);

    const navLinks = ['대시보드', '업무노트', '회의록', '일일 리포트', '검색', 'AI 챗봇', '통계'];

    navLinks.forEach((name) => {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: '관리' })).toBeInTheDocument();
  });

  it('shows manage submenu links when popover is opened', async () => {
    const user = userEvent.setup();
    render(<TopMenu />);

    await user.click(screen.getByRole('button', { name: '관리' }));

    const manageLinks = ['업무 구분', '업무 그룹', '사람 관리', '부서 관리'];
    for (const name of manageLinks) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('renders icon-only status indicators and disables connect/disconnect actions', () => {
    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: false,
      data: { connected: false },
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);

    render(<TopMenu />);

    expect(screen.queryByText('환경 설정 필요')).not.toBeInTheDocument();
    expect(screen.queryByText('연결하기')).not.toBeInTheDocument();
    expect(screen.queryByText('로그아웃')).not.toBeInTheDocument();
    expect(screen.getByLabelText('환경 설정 필요')).toBeInTheDocument();
    expect(screen.getByLabelText('Google 미연결')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Google 연결하기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Google 연결 해제' })).toBeInTheDocument();
    expect(screen.getByTestId('google-connect-button')).toBeDisabled();
    expect(screen.getByTestId('google-disconnect-button')).toBeDisabled();
  });

  it('highlights active nav icon for current path', () => {
    window.history.pushState({}, '', '/');
    render(<TopMenu />);

    const dashboardLink = screen.getByRole('link', { name: '대시보드' });
    const workNotesLink = screen.getByRole('link', { name: '업무노트' });

    expect(dashboardLink).toHaveClass('ring-1');
    expect(dashboardLink).toHaveClass('shadow-sm');
    expect(workNotesLink).not.toHaveClass('ring-1');
  });

  it('redirects to authorize when disconnected (no needsReauth)', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn().mockResolvedValue({ data: { connected: false } });

    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: true,
      data: { connected: false },
      refetch,
      isFetching: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);

    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, href: '' },
    });

    render(<TopMenu />);

    await user.click(screen.getByTestId('google-connect-button'));

    expect(refetch).toHaveBeenCalled();
    expect(window.location.href).toBe('/api/auth/google/authorize');
  });

  it('redirects to authorize when needsReauth is true', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn().mockResolvedValue({
      data: { connected: true, needsReauth: true },
    });

    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: true,
      data: { connected: true, needsReauth: true },
      refetch,
      isFetching: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);

    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, href: '' },
    });

    render(<TopMenu />);

    await user.click(screen.getByTestId('google-connect-button'));

    expect(refetch).toHaveBeenCalled();
    expect(window.location.href).toBe('/api/auth/google/authorize');
  });

  it('calls disconnect and refreshes status when disconnect is clicked', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn().mockResolvedValue({ data: { connected: false } });

    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: true,
      data: { connected: true },
      refetch,
      isFetching: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);

    render(<TopMenu />);

    await user.click(screen.getByTestId('google-disconnect-button'));

    expect(API.disconnectGoogle).toHaveBeenCalled();
    expect(refetch).toHaveBeenCalled();
  });

  it('shows error toast when disconnect fails', async () => {
    const user = userEvent.setup();
    vi.mocked(API.disconnectGoogle).mockRejectedValue(new Error('Network error'));

    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: true,
      data: { connected: true },
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);

    render(<TopMenu />);

    await user.click(screen.getByTestId('google-disconnect-button'));

    expect(toast).toHaveBeenCalledWith({
      title: '연결 해제 실패',
      description: 'Google 연결 해제 중 오류가 발생했습니다.',
      variant: 'destructive',
    });
  });

  it('full logout disconnects Google then signs out', async () => {
    const user = userEvent.setup();
    vi.mocked(API.disconnectGoogle).mockResolvedValue(undefined as never);
    mockSignOut.mockResolvedValue(undefined);

    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: true,
      data: { connected: true },
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);

    render(<TopMenu />);

    await user.click(screen.getByTestId('full-logout-button'));

    expect(API.disconnectGoogle).toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('full logout skips Google disconnect when not connected', async () => {
    const user = userEvent.setup();
    mockSignOut.mockResolvedValue(undefined);

    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: true,
      data: { connected: false },
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);

    render(<TopMenu />);

    await user.click(screen.getByTestId('full-logout-button'));

    expect(API.disconnectGoogle).not.toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('full logout still signs out when Google disconnect fails', async () => {
    const user = userEvent.setup();
    vi.mocked(API.disconnectGoogle).mockRejectedValue(new Error('disconnect error'));
    mockSignOut.mockResolvedValue(undefined);

    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: true,
      data: { connected: true },
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);

    render(<TopMenu />);

    await user.click(screen.getByTestId('full-logout-button'));

    expect(API.disconnectGoogle).toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('shows error toast when full logout fails', async () => {
    const user = userEvent.setup();
    mockSignOut.mockRejectedValue(new Error('signout error'));

    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: true,
      data: { connected: false },
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);

    render(<TopMenu />);

    await user.click(screen.getByTestId('full-logout-button'));

    expect(toast).toHaveBeenCalledWith({
      title: '로그아웃 실패',
      description: '로그아웃 중 오류가 발생했습니다.',
      variant: 'destructive',
    });
  });
});
