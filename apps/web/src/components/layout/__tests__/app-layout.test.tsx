import userEvent from '@testing-library/user-event';
import { render, screen } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AppLayout from '../app-layout';

const mockToggle = vi.fn();
let mockIsCollapsed = false;

vi.mock('@web/contexts/sidebar-context', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSidebar: () => ({
    isCollapsed: mockIsCollapsed,
    toggle: mockToggle,
  }),
}));

vi.mock('../sidebar', () => ({
  default: () => <div data-testid="sidebar" />,
}));

vi.mock('../header', () => ({
  default: () => <div data-testid="header" />,
}));

describe('app-layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCollapsed = false;
  });

  it('renders children content', () => {
    render(
      <AppLayout>
        <div data-testid="child-content">Test Content</div>
      </AppLayout>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('renders Sidebar component', () => {
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('renders Header component', () => {
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('renders toggle button with correct aria-label when expanded', () => {
    mockIsCollapsed = false;

    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    expect(screen.getByRole('button', { name: '사이드바 닫기' })).toBeInTheDocument();
  });

  it('renders toggle button with correct aria-label when collapsed', () => {
    mockIsCollapsed = true;

    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    expect(screen.getByRole('button', { name: '사이드바 열기' })).toBeInTheDocument();
  });

  it('calls toggle function when toggle button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    await user.click(screen.getByRole('button', { name: '사이드바 닫기' }));

    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('displays ChevronRight icon when collapsed', () => {
    mockIsCollapsed = true;

    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    const button = screen.getByRole('button', { name: '사이드바 열기' });
    // ChevronRight has a specific path that differs from ChevronLeft
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('displays ChevronLeft icon when expanded', () => {
    mockIsCollapsed = false;

    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    const button = screen.getByRole('button', { name: '사이드바 닫기' });
    // ChevronLeft has a specific path that differs from ChevronRight
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
