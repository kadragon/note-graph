import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGate } from '../auth-gate';

const mockSignIn = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@web/contexts/auth-context', () => ({
  useAuth: vi.fn(() => ({
    session: null,
    user: null,
    isLoading: true,
    signIn: mockSignIn,
    signOut: mockSignOut,
  })),
}));

vi.mock('@web/lib/api', () => ({
  API: {
    getMe: vi.fn(),
  },
}));

vi.mock('@web/lib/supabase', () => ({
  isSupabaseConfigured: true,
}));

vi.mock('@web/lib/pwa-reload', () => ({
  forcePwaRefresh: vi.fn(),
}));

// Import after mock setup so we can control the return value
import { useAuth } from '@web/contexts/auth-context';
import { API } from '@web/lib/api';
import { forcePwaRefresh } from '@web/lib/pwa-reload';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryDelay: 0,
        gcTime: 0,
      },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('AuthGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('shows loading state while checking auth', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: null,
      user: null,
      isLoading: true,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });

    renderWithProviders(
      <AuthGate>
        <div>Protected Content</div>
      </AuthGate>
    );

    expect(screen.getByText('인증 확인 중...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated and server validates user', async () => {
    vi.mocked(useAuth).mockReturnValue({
      session: { access_token: 'test-token' } as never,
      user: { email: 'test@example.com' } as never,
      isLoading: false,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });
    vi.mocked(API.getMe).mockResolvedValue({ email: 'test@example.com' });

    renderWithProviders(
      <AuthGate>
        <div>Protected Content</div>
      </AuthGate>
    );

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('calls signIn when not authenticated and not loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: null,
      user: null,
      isLoading: false,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });

    renderWithProviders(
      <AuthGate>
        <div>Protected Content</div>
      </AuthGate>
    );

    expect(mockSignIn).toHaveBeenCalled();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('인증 확인 중...')).toBeInTheDocument();
  });

  it('does not call signIn while still loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: null,
      user: null,
      isLoading: true,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });

    renderWithProviders(
      <AuthGate>
        <div>Protected Content</div>
      </AuthGate>
    );

    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('calls signOut when server rejects user', async () => {
    vi.mocked(useAuth).mockReturnValue({
      session: { access_token: 'test-token' } as never,
      user: { email: 'unauthorized@example.com' } as never,
      isLoading: false,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });
    vi.mocked(API.getMe).mockRejectedValue(new Error('Access denied'));

    renderWithProviders(
      <AuthGate>
        <div>Protected Content</div>
      </AuthGate>
    );

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  it('calls forcePwaRefresh when Supabase is not configured and no prior attempt', async () => {
    vi.resetModules();
    vi.doMock('@web/lib/supabase', () => ({
      isSupabaseConfigured: false,
    }));
    vi.doMock('@web/lib/pwa-reload', () => ({
      forcePwaRefresh: vi.mocked(forcePwaRefresh),
    }));
    const { AuthGate: UnconfiguredAuthGate } = await import('../auth-gate');

    vi.mocked(useAuth).mockReturnValue({
      session: null,
      user: null,
      isLoading: false,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });

    renderWithProviders(
      <UnconfiguredAuthGate>
        <div>Protected Content</div>
      </UnconfiguredAuthGate>
    );

    expect(forcePwaRefresh).toHaveBeenCalledTimes(1);
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('pwa-force-refresh-attempted')).toBe('1');

    // Reset mock to restore default
    vi.doMock('@web/lib/supabase', () => ({
      isSupabaseConfigured: true,
    }));
  });

  it('does not call forcePwaRefresh when already attempted in this session', async () => {
    sessionStorage.setItem('pwa-force-refresh-attempted', '1');

    vi.resetModules();
    vi.doMock('@web/lib/supabase', () => ({
      isSupabaseConfigured: false,
    }));
    vi.doMock('@web/lib/pwa-reload', () => ({
      forcePwaRefresh: vi.mocked(forcePwaRefresh),
    }));
    const { AuthGate: UnconfiguredAuthGate } = await import('../auth-gate');

    vi.mocked(useAuth).mockReturnValue({
      session: null,
      user: null,
      isLoading: false,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });

    renderWithProviders(
      <UnconfiguredAuthGate>
        <div>Protected Content</div>
      </UnconfiguredAuthGate>
    );

    expect(forcePwaRefresh).not.toHaveBeenCalled();

    // Reset mock to restore default
    vi.doMock('@web/lib/supabase', () => ({
      isSupabaseConfigured: true,
    }));
  });
});
