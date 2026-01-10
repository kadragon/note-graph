import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
  createQueryWrapper,
  createTestQueryClient,
  render,
  renderHookWithClient,
  screen,
  waitFor,
} from './setup';

function TestQueryComponent() {
  const queryClient = useQueryClient();
  return (
    <div data-testid="query-client">{queryClient ? 'has-query-client' : 'no-query-client'}</div>
  );
}

function TestRouterComponent() {
  const location = useLocation();
  return <div data-testid="router">{location.pathname}</div>;
}

describe('test setup', () => {
  describe('render', () => {
    it('provides QueryClientProvider', () => {
      render(<TestQueryComponent />);
      expect(screen.getByTestId('query-client')).toHaveTextContent('has-query-client');
    });

    it('provides BrowserRouter', () => {
      render(<TestRouterComponent />);
      expect(screen.getByTestId('router')).toHaveTextContent('/');
    });

    it('allows custom QueryClient', () => {
      const customClient = createTestQueryClient();
      render(<TestQueryComponent />, { queryClient: customClient });
      expect(screen.getByTestId('query-client')).toHaveTextContent('has-query-client');
    });
  });

  describe('createQueryWrapper', () => {
    it('creates a wrapper with QueryClient', () => {
      const Wrapper = createQueryWrapper();
      expect(Wrapper).toBeDefined();
      expect(typeof Wrapper).toBe('function');
    });

    it('uses provided QueryClient', () => {
      const customClient = createTestQueryClient();
      const Wrapper = createQueryWrapper(customClient);
      expect(Wrapper).toBeDefined();
    });
  });

  describe('renderHookWithClient', () => {
    it('renders hook with QueryClient context', () => {
      const { result } = renderHookWithClient(() => useQueryClient());
      expect(result.current).toBeDefined();
    });

    it('returns queryClient for assertions', () => {
      const { queryClient } = renderHookWithClient(() => useQueryClient());
      expect(queryClient).toBeDefined();
      expect(queryClient).toBeInstanceOf(Object);
    });

    it('allows custom QueryClient', () => {
      const customClient = createTestQueryClient();
      const { queryClient } = renderHookWithClient(() => useQueryClient(), {
        queryClient: customClient,
      });
      expect(queryClient).toBe(customClient);
    });

    it('works with useQuery hooks', async () => {
      const mockFn = vi.fn().mockResolvedValue('test data');

      const { result } = renderHookWithClient(() =>
        useQuery({
          queryKey: ['test'],
          queryFn: mockFn,
        })
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBe('test data');
      expect(mockFn).toHaveBeenCalledOnce();
    });
  });
});
