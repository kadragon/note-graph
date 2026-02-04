import type { ReactNode } from 'react';
import PwaUpdatePrompt from '../pwa-update-prompt';
import Header from './header';

interface AppLayoutProps {
  children: ReactNode;
}

function AppLayoutInner({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <div className="flex-1 flex flex-col">
        <Header />
        <PwaUpdatePrompt />
        <main className="flex-1 overflow-auto">
          <div className="h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: AppLayoutProps) {
  return <AppLayoutInner>{children}</AppLayoutInner>;
}
