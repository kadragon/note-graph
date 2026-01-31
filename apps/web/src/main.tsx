import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthGate } from '@web/components/auth-gate';
import { QUERY_CONFIG } from '@web/lib/config';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';
import 'highlight.js/styles/github.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: QUERY_CONFIG.REFETCH_ON_WINDOW_FOCUS,
      retry: QUERY_CONFIG.DEFAULT_RETRY_COUNT,
      staleTime: QUERY_CONFIG.DEFAULT_STALE_TIME_MS,
    },
  },
});

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthGate>
          <App />
        </AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
