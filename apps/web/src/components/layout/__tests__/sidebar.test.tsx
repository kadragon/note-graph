import { useQuery } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { useSidebar } from '@web/contexts/sidebar-context';
import { useGoogleDriveConfigStatus } from '@web/hooks/use-work-notes';
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
      data: { connected: true },
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);
  });

  it('renders logo and app title', () => {
    render(<Sidebar />);

    // The app title in the header has class "text-lg"
    const appTitle = screen.getByText('업무노트', { selector: '.text-lg' });
    expect(appTitle).toBeInTheDocument();
  });

  it('renders all navigation sections', () => {
    render(<Sidebar />);

    expect(screen.getByText('홈')).toBeInTheDocument();
    expect(screen.getByText('업무 관리')).toBeInTheDocument();
    expect(screen.getByText('조직 관리')).toBeInTheDocument();
    expect(screen.getByText('AI 도구')).toBeInTheDocument();
  });

  it('renders navigation links with correct paths', () => {
    render(<Sidebar />);

    const links = screen.getAllByRole('link');
    const linkPaths = links.map((link) => link.getAttribute('href'));

    // Home section
    expect(linkPaths).toContain('/');
    expect(linkPaths).toContain('/statistics');

    // Work management section
    expect(linkPaths).toContain('/work-notes');
    expect(linkPaths).toContain('/task-categories');
    expect(linkPaths).toContain('/projects');

    // Organization management section
    expect(linkPaths).toContain('/persons');
    expect(linkPaths).toContain('/departments');

    // AI tools section
    expect(linkPaths).toContain('/search');
    expect(linkPaths).toContain('/rag');
    expect(linkPaths).toContain('/vector-store');
  });

  it('displays user email when available', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: { email: 'test@example.com' },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useQuery>);

    render(<Sidebar />);

    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('shows default user text when no email', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useQuery>);

    render(<Sidebar />);

    expect(screen.getByText('사용자')).toBeInTheDocument();
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

  it('does not apply collapsed styles when isCollapsed is false', () => {
    vi.mocked(useSidebar).mockReturnValue({
      isCollapsed: false,
      toggle: vi.fn(),
    });

    render(<Sidebar />);

    const sidebar = screen.getByRole('complementary');
    expect(sidebar).toHaveAttribute('data-collapsed', 'false');
  });

  it('renders configured and connected status badges', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: { email: 'test@example.com' },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useQuery>);

    render(<Sidebar />);

    expect(screen.getByTestId('drive-config-badge')).toHaveTextContent('환경 설정 완료');
    expect(screen.getByTestId('drive-connection-badge')).toHaveTextContent('Drive 연결됨');
    expect(screen.getByTestId('drive-connect-button')).toHaveTextContent('연결 확인');
  });

  it('renders configured but disconnected status', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: { email: 'test@example.com' },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useQuery>);

    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: true,
      data: { connected: false },
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);

    render(<Sidebar />);

    expect(screen.getByTestId('drive-config-badge')).toHaveTextContent('환경 설정 완료');
    expect(screen.getByTestId('drive-connection-badge')).toHaveTextContent('Drive 미연결');
    expect(screen.getByTestId('drive-connect-button')).toHaveTextContent('연결하기');
  });

  it('renders not configured status', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: { email: 'test@example.com' },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useQuery>);

    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: false,
      data: { connected: false },
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);

    render(<Sidebar />);

    expect(screen.getByTestId('drive-config-badge')).toHaveTextContent('환경 설정 필요');
    expect(screen.getByTestId('drive-connect-button')).toBeDisabled();
  });

  it('handles connect button click', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn().mockResolvedValue({ data: { connected: false } });

    vi.mocked(useQuery).mockReturnValue({
      data: { email: 'test@example.com' },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useQuery>);

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

    render(<Sidebar />);

    await user.click(screen.getByTestId('drive-connect-button'));

    expect(refetch).toHaveBeenCalled();
    expect(window.location.href).toBe('/api/auth/google/authorize');
  });
});
