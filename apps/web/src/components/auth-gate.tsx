import { useAuth } from '@web/contexts/auth-context';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface AuthGateProps {
  children: ReactNode;
}

/**
 * AuthGate component that verifies Supabase authentication before rendering children.
 * Automatically redirects to Google OAuth if not authenticated.
 */
export function AuthGate({ children }: AuthGateProps) {
  const { session, isLoading, signIn } = useAuth();

  useEffect(() => {
    if (!isLoading && !session) {
      signIn();
    }
  }, [isLoading, session, signIn]);

  if (isLoading || !session) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">인증 확인 중...</p>
      </div>
    );
  }

  return <>{children}</>;
}
