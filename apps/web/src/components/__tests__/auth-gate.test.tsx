import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { API, cfTokenRefresher } from '@web/lib/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGate } from '../auth-gate';

vi.mock('@web/lib/api', async () => {
  const actual = await vi.importActual('@web/lib/api');
  return {
    ...actual,
    API: {
      getMe: vi.fn(),
    },
    cfTokenRefresher: {
      isOnline: vi.fn(() => true),
      isNetworkError: vi.fn(),
      isCFAccessError: vi.fn(),
      forceAuthRedirect: vi.fn(),
    },
  };
});

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
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
    vi.mocked(cfTokenRefresher.isOnline).mockReturnValue(true);
  });

  it('shows loading state while checking auth', () => {
    vi.mocked(API.getMe).mockImplementation(() => new Promise(() => {})); // Never resolves

    renderWithProviders(
      <AuthGate>
        <div>Protected Content</div>
      </AuthGate>
    );

    expect(screen.getByText('인증 확인 중...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', async () => {
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

  it('triggers redirect on CF Access error when online and origin reachable', async () => {
    const cfError = new TypeError('Failed to fetch');
    vi.mocked(API.getMe).mockRejectedValue(cfError);
    vi.mocked(cfTokenRefresher.isNetworkError).mockReturnValue(true);
    vi.mocked(cfTokenRefresher.isOnline).mockReturnValue(true);
    vi.mocked(cfTokenRefresher.forceAuthRedirect).mockResolvedValue(true);

    renderWithProviders(
      <AuthGate>
        <div>Protected Content</div>
      </AuthGate>
    );

    await waitFor(
      () => {
        expect(cfTokenRefresher.forceAuthRedirect).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    expect(screen.getByText('로그인 페이지로 이동 중...')).toBeInTheDocument();
  });

  it('shows offline state when browser is offline', async () => {
    const cfError = new TypeError('Failed to fetch');
    vi.mocked(API.getMe).mockRejectedValue(cfError);
    vi.mocked(cfTokenRefresher.isNetworkError).mockReturnValue(true);
    vi.mocked(cfTokenRefresher.isOnline).mockReturnValue(false);

    renderWithProviders(
      <AuthGate>
        <div>Protected Content</div>
      </AuthGate>
    );

    await waitFor(
      () => {
        expect(screen.getByText('인터넷 연결이 끊어졌습니다.')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(cfTokenRefresher.forceAuthRedirect).not.toHaveBeenCalled();
  });

  it('shows error state when origin is not reachable', async () => {
    const cfError = new TypeError('Failed to fetch');
    vi.mocked(API.getMe).mockRejectedValue(cfError);
    vi.mocked(cfTokenRefresher.isNetworkError).mockReturnValue(true);
    vi.mocked(cfTokenRefresher.isOnline).mockReturnValue(true);
    vi.mocked(cfTokenRefresher.forceAuthRedirect).mockResolvedValue(false); // Origin not reachable

    renderWithProviders(
      <AuthGate>
        <div>Protected Content</div>
      </AuthGate>
    );

    await waitFor(
      () => {
        expect(screen.getByText('서버에 연결할 수 없습니다.')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('shows error state on non-network error', async () => {
    vi.mocked(API.getMe).mockRejectedValue(new Error('Server error'));
    vi.mocked(cfTokenRefresher.isNetworkError).mockReturnValue(false);

    renderWithProviders(
      <AuthGate>
        <div>Protected Content</div>
      </AuthGate>
    );

    await waitFor(
      () => {
        expect(screen.getByText('서버에 연결할 수 없습니다.')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByText('다시 시도')).toBeInTheDocument();
  });

  it('shows retry button in error state that can be clicked', async () => {
    vi.mocked(API.getMe).mockRejectedValue(new Error('Server error'));
    vi.mocked(cfTokenRefresher.isNetworkError).mockReturnValue(false);

    renderWithProviders(
      <AuthGate>
        <div>Protected Content</div>
      </AuthGate>
    );

    // Wait for error state to appear
    await waitFor(
      () => {
        expect(screen.getByText('서버에 연결할 수 없습니다.')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify retry button is present
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('triggers redirect on CORS error (CF Access expired) when online', async () => {
    // CORS error occurs when CF Access token expired and server responds with redirect
    const corsError = new TypeError('Failed to fetch');
    vi.mocked(API.getMe).mockRejectedValue(corsError);
    vi.mocked(cfTokenRefresher.isNetworkError).mockReturnValue(true);
    vi.mocked(cfTokenRefresher.isOnline).mockReturnValue(true);
    // forceAuthRedirect returns true when origin is reachable (even via no-cors opaque response)
    vi.mocked(cfTokenRefresher.forceAuthRedirect).mockResolvedValue(true);

    renderWithProviders(
      <AuthGate>
        <div>Protected Content</div>
      </AuthGate>
    );

    await waitFor(
      () => {
        expect(cfTokenRefresher.forceAuthRedirect).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    // Should show redirecting message, not error
    expect(screen.getByText('로그인 페이지로 이동 중...')).toBeInTheDocument();
    expect(screen.queryByText('서버에 연결할 수 없습니다.')).not.toBeInTheDocument();
  });
});
