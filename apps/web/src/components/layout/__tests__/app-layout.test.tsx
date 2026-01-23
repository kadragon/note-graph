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

  it.each([
    [false, '사이드바 닫기'],
    [true, '사이드바 열기'],
  ])('renders toggle button label for collapsed=%s', (collapsed, label) => {
    mockIsCollapsed = collapsed;

    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
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
});
