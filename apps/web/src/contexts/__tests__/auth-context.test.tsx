import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Track onAuthStateChange callback
let authStateCallback: ((event: string, session: unknown) => void) | null = null;

const mockSignInWithOAuth = vi.fn().mockResolvedValue({ error: null });
const mockSignOut = vi.fn().mockResolvedValue({});
const mockGetSession = vi.fn().mockResolvedValue({
  data: { session: null },
});
const mockOnAuthStateChange = vi.fn().mockImplementation((cb) => {
  authStateCallback = cb;
  return { data: { subscription: { unsubscribe: vi.fn() } } };
});

vi.mock('@web/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      signInWithOAuth: (opts: unknown) => mockSignInWithOAuth(opts),
      signOut: () => mockSignOut(),
      onAuthStateChange: (cb: unknown) => mockOnAuthStateChange(cb),
    },
  },
}));

vi.mock('@web/lib/api', () => ({
  API: {
    storeProviderTokens: vi.fn().mockResolvedValue({ success: true }),
  },
}));

import { API } from '@web/lib/api';
import { SupabaseAuthProvider, useAuth } from '../auth-context';

function TestConsumer() {
  const { signIn, isLoading, user } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="user">{user?.email ?? 'none'}</span>
      <button type="button" onClick={signIn}>
        Sign In
      </button>
    </div>
  );
}

describe('auth-context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;
    mockGetSession.mockResolvedValue({ data: { session: null } });
  });

  it('signIn includes Drive/Calendar scopes and offline access params', async () => {
    const user = userEvent.setup();
    render(
      <SupabaseAuthProvider>
        <TestConsumer />
      </SupabaseAuthProvider>
    );

    await user.click(screen.getByText('Sign In'));

    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        options: expect.objectContaining({
          scopes:
            'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar.readonly',
          queryParams: expect.objectContaining({
            access_type: 'offline',
            prompt: 'consent',
          }),
        }),
      })
    );
  });

  it('captures provider_token on SIGNED_IN and sends to backend', async () => {
    render(
      <SupabaseAuthProvider>
        <TestConsumer />
      </SupabaseAuthProvider>
    );

    await waitFor(() => {
      expect(authStateCallback).not.toBeNull();
    });

    act(() => {
      authStateCallback?.('SIGNED_IN', {
        access_token: 'supabase-jwt',
        provider_token: 'google-access-token',
        provider_refresh_token: 'google-refresh-token',
        user: { email: 'test@example.com' },
      });
    });

    await waitFor(() => {
      expect(API.storeProviderTokens).toHaveBeenCalledWith(
        'google-access-token',
        'google-refresh-token'
      );
    });
  });

  it('does not call storeProviderTokens when provider_token is absent', async () => {
    render(
      <SupabaseAuthProvider>
        <TestConsumer />
      </SupabaseAuthProvider>
    );

    await waitFor(() => {
      expect(authStateCallback).not.toBeNull();
    });

    act(() => {
      authStateCallback?.('SIGNED_IN', {
        access_token: 'supabase-jwt',
        user: { email: 'test@example.com' },
      });
    });

    // Give it a tick to ensure no async call was made
    await new Promise((r) => setTimeout(r, 10));
    expect(API.storeProviderTokens).not.toHaveBeenCalled();
  });

  it('logs error but does not throw when storeProviderTokens fails', async () => {
    vi.mocked(API.storeProviderTokens).mockRejectedValueOnce(new Error('Network error'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <SupabaseAuthProvider>
        <TestConsumer />
      </SupabaseAuthProvider>
    );

    await waitFor(() => {
      expect(authStateCallback).not.toBeNull();
    });

    act(() => {
      authStateCallback?.('SIGNED_IN', {
        access_token: 'supabase-jwt',
        provider_token: 'google-access-token',
        provider_refresh_token: null,
        user: { email: 'test@example.com' },
      });
    });

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('provider token'),
        expect.any(Error)
      );
    });

    consoleError.mockRestore();
  });
});
