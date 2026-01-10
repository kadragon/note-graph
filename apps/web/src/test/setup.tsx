import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RenderHookOptions, RenderOptions } from '@testing-library/react';
import { render, renderHook } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';

/**
 * Create a QueryClient configured for tests (no retries, instant gc)
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Create a wrapper component for testing hooks with React Query
 */
export function createQueryWrapper(queryClient?: QueryClient) {
  const client = queryClient ?? createTestQueryClient();
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };
}

interface RenderHookWithClientOptions<TProps> extends Omit<RenderHookOptions<TProps>, 'wrapper'> {
  queryClient?: QueryClient;
}

/**
 * Render a hook with QueryClient and Router providers
 * Returns the hook result and the queryClient for assertions
 */
export function renderHookWithClient<TResult, TProps>(
  hook: (props: TProps) => TResult,
  options: RenderHookWithClientOptions<TProps> = {}
) {
  const { queryClient: providedClient, ...renderOptions } = options;
  const queryClient = providedClient ?? createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);

  const result = renderHook(hook, { wrapper, ...renderOptions });

  return {
    ...result,
    queryClient,
  };
}

interface AllProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

/**
 * All providers wrapper for testing
 */
function AllProviders({ children, queryClient }: AllProvidersProps) {
  const client = queryClient ?? createTestQueryClient();
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

/**
 * Custom render function that wraps components with all providers
 */
function customRender(ui: ReactElement, options: CustomRenderOptions = {}) {
  const { queryClient, ...renderOptions } = options;
  return render(ui, {
    wrapper: ({ children }) => <AllProviders queryClient={queryClient}>{children}</AllProviders>,
    ...renderOptions,
  });
}

export * from '@testing-library/react';
export { customRender as render };
