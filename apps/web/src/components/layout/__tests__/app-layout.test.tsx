import { render, screen } from '@web/test/setup';
import { describe, expect, it, vi } from 'vitest';

import AppLayout from '../app-layout';

vi.mock('../header', () => ({
  default: () => <div data-testid="header" />,
}));

describe('app-layout', () => {
  it('renders header and hides sidebar toggle', () => {
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '사이드바 닫기' })).not.toBeInTheDocument();
  });
});
