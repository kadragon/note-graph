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

  it('triggers redirect on CF Access error', async () => {
    const cfError = new TypeError('Failed to fetch');
    vi.mocked(API.getMe).mockRejectedValue(cfError);
    vi.mocked(cfTokenRefresher.isCFAccessError).mockReturnValue(true);
    vi.mocked(cfTokenRefresher.forceAuthRedirect).mockResolvedValue();

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
  });

  it('shows error state on non-CF Access error', async () => {
    vi.mocked(API.getMe).mockRejectedValue(new Error('Server error'));
    vi.mocked(cfTokenRefresher.isCFAccessError).mockReturnValue(false);

    renderWithProviders(
      <AuthGate>
        <div>Protected Content</div>
      </AuthGate>
    );

    await waitFor(
      () => {
        expect(screen.getByText('인증 확인 중 오류가 발생했습니다.')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByText('다시 시도')).toBeInTheDocument();
  });
});
