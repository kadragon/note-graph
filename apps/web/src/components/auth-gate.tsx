import { useQuery } from '@tanstack/react-query';
import { API, cfTokenRefresher } from '@web/lib/api';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

interface AuthGateProps {
  children: ReactNode;
}

/**
 * AuthGate component that verifies authentication before rendering children.
 * If authentication fails, it will trigger a redirect to Cloudflare Access login.
 */
export function AuthGate({ children }: AuthGateProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const {
    data: user,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['auth-check'],
    queryFn: () => API.getMe(),
    retry: 1,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    // If auth check failed with a CF Access error, trigger redirect
    if (isError && cfTokenRefresher.isCFAccessError(error)) {
      setIsRedirecting(true);
      cfTokenRefresher.forceAuthRedirect();
    }
  }, [isError, error]);

  // Show loading state while checking auth
  if (isLoading || isRedirecting) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">
          {isRedirecting ? '로그인 페이지로 이동 중...' : '인증 확인 중...'}
        </p>
      </div>
    );
  }

  // If auth failed but not a CF Access error, show error state
  if (isError && !cfTokenRefresher.isCFAccessError(error)) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive">인증 확인 중 오류가 발생했습니다.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // If we have a user, render children
  if (user) {
    return <>{children}</>;
  }

  // Fallback loading state
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
