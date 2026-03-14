import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@web/contexts/auth-context';
import { API } from '@web/lib/api';
import { PWA_CONFIG } from '@web/lib/config';
import { forcePwaRefresh } from '@web/lib/pwa-reload';
import { isSupabaseConfigured } from '@web/lib/supabase';
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

  // If Supabase is not configured (e.g., stale PWA cache), force refresh once per session
  useEffect(() => {
    if (
      !isSupabaseConfigured &&
      sessionStorage.getItem(PWA_CONFIG.FORCE_REFRESH_SESSION_KEY) !== '1'
    ) {
      sessionStorage.setItem(PWA_CONFIG.FORCE_REFRESH_SESSION_KEY, '1');
      forcePwaRefresh();
    }
  }, []);

  useEffect(() => {
    if (!isLoading && !session && isSupabaseConfigured) {
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
