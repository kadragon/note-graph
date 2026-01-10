import { render, screen } from '@web/test/setup';
import { describe, expect, it, vi } from 'vitest';

import Dashboard from '../dashboard';

vi.mock('../dashboard/components/todo-tabs', () => ({
  TodoTabs: () => <div data-testid="todo-tabs" />,
}));

describe('dashboard page', () => {
  it('renders the todo section', () => {
    render(<Dashboard />);

    expect(screen.getByText('할 일 목록')).toBeInTheDocument();
    expect(screen.getByTestId('todo-tabs')).toBeInTheDocument();
  });
});
