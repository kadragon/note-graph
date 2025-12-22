import { SidebarProvider, useSidebar } from '@web/contexts/sidebar-context';
import { cn } from '@web/lib/utils';
import type { ReactNode } from 'react';
import Header from './header';
import Sidebar from './sidebar';

interface AppLayoutProps {
  children: ReactNode;
}

function AppLayoutInner({ children }: AppLayoutProps) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <div
        data-sidebar-collapsed={isCollapsed}
        className={cn(
          'flex-1 flex flex-col',
          'transition-[margin] duration-300 ease-in-out',
          'data-[sidebar-collapsed=false]:ml-sidebar',
          'data-[sidebar-collapsed=true]:ml-0'
        )}
      >
        <Header />
        <main className="flex-1 overflow-auto">
          <div className="h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </SidebarProvider>
  );
}
