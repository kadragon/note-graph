// Trace: Phase 5.2 - Add Error Boundaries
// Tests for App component with ErrorBoundary integration

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import App from './App';

// Mock the lazy-loaded pages to avoid loading actual components
vi.mock('@web/pages/dashboard', () => ({
  default: () => <div>Dashboard Page</div>,
}));

vi.mock('@web/pages/work-notes', () => ({
  default: () => <div>Work Notes Page</div>,
}));

vi.mock('@web/pages/persons', () => ({
  default: () => <div>Persons Page</div>,
}));

vi.mock('@web/pages/departments', () => ({
  default: () => <div>Departments Page</div>,
}));

vi.mock('@web/pages/task-categories/task-categories', () => ({
  default: () => <div>Task Categories Page</div>,
}));

vi.mock('@web/pages/search', () => ({
  default: () => <div>Search Page</div>,
}));

vi.mock('@web/pages/rag', () => ({
  default: () => <div>RAG Page</div>,
}));

vi.mock('@web/pages/pdf-upload', () => ({
  default: () => <div>PDF Upload Page</div>,
}));

vi.mock('@web/pages/vector-store', () => ({
  default: () => <div>Vector Store Page</div>,
}));

vi.mock('@web/pages/projects', () => ({
  default: () => <div>Projects Page</div>,
}));

vi.mock('@web/pages/statistics', () => ({
  default: () => <div>Statistics Page</div>,
}));

// Mock layout to simplify testing
vi.mock('@web/components/layout/app-layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

function renderApp(initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('App', () => {
  it('renders dashboard on root route', async () => {
    renderApp('/');

    expect(await screen.findByText('Dashboard Page')).toBeInTheDocument();
    expect(await screen.findByTestId('app-layout')).toBeInTheDocument();
  });

  it('renders work notes page on /work-notes route', async () => {
    renderApp('/work-notes');

    expect(await screen.findByText('Work Notes Page')).toBeInTheDocument();
  });
});
