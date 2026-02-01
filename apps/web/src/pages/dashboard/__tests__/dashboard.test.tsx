import userEvent from '@testing-library/user-event';
import { useCalendarEvents } from '@web/hooks/use-calendar';
import { useTodos } from '@web/hooks/use-todos';
import { useGoogleDriveConfigStatus } from '@web/hooks/use-work-notes';
import { render, screen } from '@web/test/setup';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '../dashboard';

// Mock hooks
vi.mock('@web/hooks/use-work-notes', () => ({
  useGoogleDriveConfigStatus: vi.fn(),
}));

vi.mock('@web/hooks/use-calendar', () => ({
  useCalendarEvents: vi.fn(),
}));

vi.mock('@web/hooks/use-todos', () => ({
  useTodos: vi.fn(),
}));

// Mock Tabs component to avoid portal complexities
vi.mock('@web/components/ui/tabs', () => ({
  Tabs: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
  }) => (
    <div
      data-testid="tabs"
      data-value={value}
      role="tablist"
      onClick={() => onValueChange?.('week')}
      onKeyDown={() => onValueChange?.('week')}
      tabIndex={0}
    >
      {children}
    </div>
  ),
  TabsList: ({ children }: { children: ReactNode }) => (
    <div data-testid="tabs-list">{children}</div>
  ),
  TabsTrigger: ({
    value,
    children,
    onClick,
  }: {
    value: string;
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" data-testid={`tab-${value}`} onClick={onClick}>
      {children}
    </button>
  ),
}));

// Mock ViewWorkNoteDialog to avoid complex dialog rendering
vi.mock('@web/pages/work-notes/components/view-work-note-dialog', () => ({
  ViewWorkNoteDialog: ({ open }: { open: boolean }) => (
    <div data-testid="work-note-dialog" data-open={open ? 'true' : 'false'} />
  ),
}));

// Mock WeekCalendar component
vi.mock('../components/week-calendar', () => ({
  WeekCalendar: ({
    events,
    weeks,
  }: {
    events: Array<{ id: string; summary: string }>;
    weeks: number;
  }) => (
    <div data-testid="week-calendar" data-event-count={events.length} data-weeks={weeks}>
      {events.map((e) => (
        <div key={e.id} data-testid={`event-${e.id}`}>
          {e.summary}
        </div>
      ))}
    </div>
  ),
}));

// Mock TodoList component
vi.mock('../components/todo-list', () => ({
  TodoList: ({
    todos,
    isLoading,
    onTodoClick,
  }: {
    todos: Array<{ id: string; title: string; workNoteId?: string }>;
    isLoading: boolean;
    onTodoClick?: (todo: { id: string; title: string; workNoteId?: string }) => void;
  }) => (
    <div data-testid="todo-list" data-loading={isLoading ? 'true' : 'false'}>
      {todos.map((todo) => (
        <button
          type="button"
          key={todo.id}
          data-testid={`todo-${todo.id}`}
          onClick={() => onTodoClick?.(todo)}
        >
          {todo.title}
        </button>
      ))}
    </div>
  ),
}));

describe('dashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock: Google Drive not configured
    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: false,
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);

    // Default mock: no calendar events
    vi.mocked(useCalendarEvents).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCalendarEvents>);

    // Default mock: no todos
    vi.mocked(useTodos).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useTodos>);
  });

  it('renders the todo section title', () => {
    render(<Dashboard />);

    expect(screen.getByText('할 일 목록')).toBeInTheDocument();
  });

  it('renders todo tabs with all view options', () => {
    render(<Dashboard />);

    expect(screen.getByTestId('tab-today')).toBeInTheDocument();
    expect(screen.getByTestId('tab-week')).toBeInTheDocument();
    expect(screen.getByTestId('tab-month')).toBeInTheDocument();
    expect(screen.getByTestId('tab-remaining')).toBeInTheDocument();
  });

  it('renders todo list with data', () => {
    vi.mocked(useTodos).mockReturnValue({
      data: [
        { id: 'todo-1', title: '첫 번째 할일', status: 'pending', createdAt: '', updatedAt: '' },
        { id: 'todo-2', title: '두 번째 할일', status: 'pending', createdAt: '', updatedAt: '' },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useTodos>);

    render(<Dashboard />);

    expect(screen.getByTestId('todo-list')).toHaveAttribute('data-loading', 'false');
    expect(screen.getByTestId('todo-todo-1')).toHaveTextContent('첫 번째 할일');
    expect(screen.getByTestId('todo-todo-2')).toHaveTextContent('두 번째 할일');
  });

  it('shows loading state when todos are loading', () => {
    vi.mocked(useTodos).mockReturnValue({
      data: [],
      isLoading: true,
    } as unknown as ReturnType<typeof useTodos>);

    render(<Dashboard />);

    expect(screen.getByTestId('todo-list')).toHaveAttribute('data-loading', 'true');
  });

  it('does not render calendar card when Google Drive is not configured', () => {
    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: false,
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);

    render(<Dashboard />);

    expect(screen.queryByText('캘린더')).not.toBeInTheDocument();
  });

  it('renders calendar loading state when status is loading', () => {
    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: true,
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);

    render(<Dashboard />);

    expect(screen.getByText('캘린더')).toBeInTheDocument();
  });

  it('renders calendar connect prompt when configured but not connected', () => {
    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: true,
      data: { configured: true, connected: false },
      isLoading: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);

    render(<Dashboard />);

    expect(screen.getByText('캘린더')).toBeInTheDocument();
    expect(screen.getByText('Google 캘린더를 연결하여 일정을 확인하세요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Google 계정 연결/i })).toHaveAttribute(
      'href',
      '/api/auth/google/authorize'
    );
  });

  it('renders calendar with events when connected', () => {
    vi.mocked(useGoogleDriveConfigStatus).mockReturnValue({
      configured: true,
      data: { configured: true, connected: true },
      isLoading: false,
    } as unknown as ReturnType<typeof useGoogleDriveConfigStatus>);

    vi.mocked(useCalendarEvents).mockReturnValue({
      data: [
        {
          id: 'event-1',
          summary: '회의',
          start: { dateTime: '2025-01-15T10:00:00' },
          end: { dateTime: '2025-01-15T11:00:00' },
          htmlLink: 'https://calendar.google.com/event/1',
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCalendarEvents>);

    render(<Dashboard />);

    expect(screen.getByText('캘린더')).toBeInTheDocument();
    expect(screen.getByTestId('week-calendar')).toHaveAttribute('data-event-count', '1');
    expect(screen.getByTestId('event-event-1')).toHaveTextContent('회의');
  });

  it('clicking a todo with workNoteId opens the work note dialog', async () => {
    const user = userEvent.setup();

    vi.mocked(useTodos).mockReturnValue({
      data: [
        {
          id: 'todo-1',
          title: '업무 할일',
          status: 'pending',
          workNoteId: 'work-123',
          createdAt: '',
          updatedAt: '',
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useTodos>);

    render(<Dashboard />);

    await user.click(screen.getByTestId('todo-todo-1'));

    expect(screen.getByTestId('work-note-dialog')).toHaveAttribute('data-open', 'true');
  });
});
