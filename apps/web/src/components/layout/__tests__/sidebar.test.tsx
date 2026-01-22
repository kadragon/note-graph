import { useQuery } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { useSidebar } from '@web/contexts/sidebar-context';
import { useGoogleDriveConfigStatus } from '@web/hooks/use-work-notes';
import { API } from '@web/lib/api';
import { render, screen } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Sidebar from '../sidebar';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('@web/contexts/sidebar-context', () => ({
  useSidebar: vi.fn(),
}));

vi.mock('@web/hooks/use-work-notes', () => ({
  useGoogleDriveConfigStatus: vi.fn(),
}));

vi.mock('@web/lib/api', () => ({
  API: {
    disconnectGoogle: vi.fn(),
  },
}));

describe('sidebar component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSidebar).mockReturnValue({
      isCollapsed: false,
      toggle: vi.fn(),
    });
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useQuery>);

    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: true,
      data: { connected: true, calendarConnected: true },
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);
  });

  it('applies collapsed styles when isCollapsed is true', () => {
    vi.mocked(useSidebar).mockReturnValue({
      isCollapsed: true,
      toggle: vi.fn(),
    });

    render(<Sidebar />);

    const sidebar = screen.getByRole('complementary');
    expect(sidebar).toHaveAttribute('data-collapsed', 'true');
  });

  it('shows not configured state and disables connect/disconnect actions', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: { email: 'test@example.com' },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useQuery>);

    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: false,
      data: { connected: false, calendarConnected: false },
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);

    render(<Sidebar />);

    expect(screen.getByTestId('drive-config-badge')).toHaveTextContent('환경 설정 필요');
    expect(screen.getByTestId('google-connect-button')).toBeDisabled();
    expect(screen.getByTestId('google-disconnect-button')).toBeDisabled();
  });

  it('handles connect button click', async () => {
    const user = userEvent.setup();
    const refetch = vi
      .fn()
      .mockResolvedValue({ data: { connected: false, calendarConnected: false } });

    vi.mocked(useQuery).mockReturnValue({
      data: { email: 'test@example.com' },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useQuery>);

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

    render(<Sidebar />);

    await user.click(screen.getByTestId('google-connect-button'));

    expect(refetch).toHaveBeenCalled();
    expect(window.location.href).toBe('/api/auth/google/authorize');
  });

  it('handles disconnect button click', async () => {
    const user = userEvent.setup();
    const refetch = vi
      .fn()
      .mockResolvedValue({ data: { connected: false, calendarConnected: false } });

    vi.mocked(useQuery).mockReturnValue({
      data: { email: 'test@example.com' },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useQuery>);

    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: true,
      data: { connected: true, calendarConnected: true },
      refetch,
      isFetching: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);

    render(<Sidebar />);

    await user.click(screen.getByTestId('google-disconnect-button'));

    expect(API.disconnectGoogle).toHaveBeenCalled();
    expect(refetch).toHaveBeenCalled();
  });
});
