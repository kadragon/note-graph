import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@web/contexts/auth-context';
import { API } from '@web/lib/api';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface AuthGateProps {
  children: ReactNode;
}

/**
 * AuthGate component that verifies Supabase authentication before rendering children.
 * Automatically redirects to Google OAuth if not authenticated.
 * After session is established, verifies server-side identity via /api/me.
 */
export function AuthGate({ children }: AuthGateProps) {
  const { session, isLoading, signIn, signOut } = useAuth();

  const {
    data: me,
    isLoading: isMeLoading,
    error: meError,
  } = useQuery({
    queryKey: ['me'],
    queryFn: () => API.getMe(),
    enabled: !!session,
    retry: 1,
    retryDelay: 0,
  });

  useEffect(() => {
    if (!isLoading && !session) {
      signIn();
    }
  }, [isLoading, session, signIn]);

  // Server rejected user (e.g. ALLOWED_USER_EMAIL mismatch)
  useEffect(() => {
    if (meError) {
      signOut();
    }
  }, [meError, signOut]);

  if (isLoading || !session || isMeLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">인증 확인 중...</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
        <p className="text-sm text-destructive">인증에 실패했습니다. 다시 로그인해주세요.</p>
      </div>
    );
  }

  return <>{children}</>;
}
