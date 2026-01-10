import userEvent from '@testing-library/user-event';
import { fireEvent, render, screen } from '@web/test/setup';
import { useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Header from '../header';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: vi.fn(),
    useNavigate: vi.fn(),
  };
});

describe('header component', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });
  });

  it('renders page title based on current path (대시보드 for /)', () => {
    render(<Header />);

    expect(screen.getByText('대시보드')).toBeInTheDocument();
  });

  it('renders search input with placeholder (검색... (⌘/Ctrl+K))', () => {
    render(<Header />);

    expect(screen.getByPlaceholderText('검색... (⌘/Ctrl+K)')).toBeInTheDocument();
  });

  it('navigates to search page on Enter with query', async () => {
    const user = userEvent.setup();
    render(<Header />);

    const searchInput = screen.getByPlaceholderText('검색... (⌘/Ctrl+K)');
    await user.type(searchInput, '테스트 검색어{enter}');

    expect(mockNavigate).toHaveBeenCalledWith(
      '/search?q=%ED%85%8C%EC%8A%A4%ED%8A%B8%20%EA%B2%80%EC%83%89%EC%96%B4'
    );
  });

  it('clears search input after navigation', async () => {
    const user = userEvent.setup();
    render(<Header />);

    const searchInput = screen.getByPlaceholderText('검색... (⌘/Ctrl+K)') as HTMLInputElement;
    await user.type(searchInput, '테스트{enter}');

    expect(searchInput.value).toBe('');
  });

  it('focuses search input on Ctrl+K keyboard shortcut', () => {
    render(<Header />);

    const searchInput = screen.getByPlaceholderText('검색... (⌘/Ctrl+K)');

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

    expect(document.activeElement).toBe(searchInput);
  });

  it('focuses search input on / key when not in input', () => {
    render(<Header />);

    const searchInput = screen.getByPlaceholderText('검색... (⌘/Ctrl+K)');

    fireEvent.keyDown(document, { key: '/' });

    expect(document.activeElement).toBe(searchInput);
  });

  it('blurs search input on Escape key', async () => {
    const user = userEvent.setup();
    render(<Header />);

    const searchInput = screen.getByPlaceholderText('검색... (⌘/Ctrl+K)');
    await user.click(searchInput);
    expect(document.activeElement).toBe(searchInput);

    await user.keyboard('{Escape}');

    expect(document.activeElement).not.toBe(searchInput);
  });

  it('shows different titles for different paths (/work-notes -> 업무노트)', () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/work-notes',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });

    render(<Header />);

    expect(screen.getByText('업무노트')).toBeInTheDocument();
  });
});
