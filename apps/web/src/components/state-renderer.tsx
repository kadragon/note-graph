import type { ReactNode } from 'react';

interface StateRendererProps {
  isLoading: boolean;
  isEmpty: boolean;
  error?: Error | null;
  emptyMessage?: string;
  errorMessage?: string;
  children: ReactNode;
}

export function StateRenderer({
  isLoading,
  isEmpty,
  error,
  emptyMessage = '데이터가 없습니다.',
  errorMessage = '오류가 발생했습니다.',
  children,
}: StateRendererProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="loading-spinner">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-sm font-medium text-destructive">{errorMessage}</p>
        <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
}
