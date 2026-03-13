import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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

// Import after mock setup so we can control the return value
import { useAuth } from '@web/contexts/auth-context';

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

  it('renders children when authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: { access_token: 'test-token' } as never,
      user: { email: 'test@example.com' } as never,
      isLoading: false,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });

    renderWithProviders(
      <AuthGate>
        <div>Protected Content</div>
      </AuthGate>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
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
});
