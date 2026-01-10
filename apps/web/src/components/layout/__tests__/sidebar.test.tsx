import { useQuery } from '@tanstack/react-query';
import { useSidebar } from '@web/contexts/sidebar-context';
import { render, screen } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Sidebar from '../sidebar';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('@web/contexts/sidebar-context', () => ({
  useSidebar: vi.fn(),
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
});
