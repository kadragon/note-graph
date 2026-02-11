import userEvent from '@testing-library/user-event';
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

describe('top-menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: true,
      data: { connected: true, calendarConnected: true },
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);
  });

  it('renders main navigation links', () => {
    render(<TopMenu />);

    expect(screen.getByRole('link', { name: '대시보드' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AI 로그' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '업무노트' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '사람 관리' })).toBeInTheDocument();
  });

  it('renders icon-only status indicators and disables connect/disconnect actions', () => {
    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: false,
      data: { connected: false, calendarConnected: false },
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);

    render(<TopMenu />);

    expect(screen.queryByText('환경 설정 필요')).not.toBeInTheDocument();
    expect(screen.queryByText('연결하기')).not.toBeInTheDocument();
    expect(screen.queryByText('로그아웃')).not.toBeInTheDocument();
    expect(screen.getByLabelText('환경 설정 필요')).toBeInTheDocument();
    expect(screen.getByLabelText('Drive 미연결')).toBeInTheDocument();
    expect(screen.getByLabelText('캘린더 미연결')).toBeInTheDocument();
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

  it('refreshes status and redirects when connect is clicked while disconnected', async () => {
    const user = userEvent.setup();
    const refetch = vi
      .fn()
      .mockResolvedValue({ data: { connected: false, calendarConnected: false } });

    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: true,
      data: { connected: false, calendarConnected: false },
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
    const refetch = vi
      .fn()
      .mockResolvedValue({ data: { connected: false, calendarConnected: false } });

    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: true,
      data: { connected: true, calendarConnected: true },
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
      data: { connected: true, calendarConnected: true },
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
});
