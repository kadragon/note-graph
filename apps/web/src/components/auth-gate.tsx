import { useQuery } from '@tanstack/react-query';
import { API, cfTokenRefresher } from '@web/lib/api';
import { Loader2, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';

interface AuthGateProps {
  children: ReactNode;
}

type AuthState = 'loading' | 'authenticated' | 'redirecting' | 'offline' | 'error';

/**
 * AuthGate component that verifies authentication before rendering children.
 * If authentication fails due to CF Access, triggers a redirect to login.
 * Distinguishes between network errors (offline/server down) and auth errors.
 */
export function AuthGate({ children }: AuthGateProps) {
  const [authState, setAuthState] = useState<AuthState>('loading');

  const {
    data: user,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['auth-check'],
    queryFn: () => API.getMe(),
    retry: 1,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleAuthError = useCallback(async () => {
    // Check if it's a network error (includes both offline and CORS from CF Access)
    const isNetworkError = cfTokenRefresher.isNetworkError(error);

    if (!isNetworkError) {
      // Not a network error - show generic error state
      setAuthState('error');
      return;
    }

    // Check if browser is offline
    if (!cfTokenRefresher.isOnline()) {
      setAuthState('offline');
      return;
    }

    // Online but getting network errors - likely CF Access redirect
    // Try to force auth redirect (will verify origin is reachable first)
    setAuthState('redirecting');
    const redirected = await cfTokenRefresher.forceAuthRedirect();

    if (!redirected) {
      // Origin not reachable - server might be down, not an auth issue
      setAuthState('error');
    }
    // If redirected is true, the page will reload and this code won't continue
  }, [error]);

  useEffect(() => {
    if (isError) {
      handleAuthError();
    }
  }, [isError, handleAuthError]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      if (authState === 'offline') {
        setAuthState('loading');
        refetch();
      }
    };

    const handleOffline = () => {
      if (authState === 'loading' || authState === 'error') {
        setAuthState('offline');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [authState, refetch]);

  // Update auth state based on query state
  useEffect(() => {
    if (isLoading && authState !== 'redirecting') {
      setAuthState('loading');
    } else if (user) {
      setAuthState('authenticated');
    }
  }, [isLoading, user, authState]);

  // Show loading state
  if (authState === 'loading' || authState === 'redirecting') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">
          {authState === 'redirecting' ? '로그인 페이지로 이동 중...' : '인증 확인 중...'}
        </p>
      </div>
    );
  }

  // Show offline state
  if (authState === 'offline') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <WifiOff className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">인터넷 연결이 끊어졌습니다.</p>
          <p className="text-sm text-muted-foreground">연결 상태를 확인하고 다시 시도해 주세요.</p>
          <button
            type="button"
            onClick={() => {
              if (cfTokenRefresher.isOnline()) {
                setAuthState('loading');
                refetch();
              }
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // Show error state (server error or unreachable)
  if (authState === 'error') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive">서버에 연결할 수 없습니다.</p>
          <p className="text-sm text-muted-foreground">잠시 후 다시 시도해 주세요.</p>
          <button
            type="button"
            onClick={() => {
              setAuthState('loading');
              refetch();
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // Authenticated - render children
  if (authState === 'authenticated' && user) {
    return <>{children}</>;
  }

  // Fallback loading state
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
