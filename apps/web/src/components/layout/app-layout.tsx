import { Button } from '@web/components/ui/button';
import { SidebarProvider, useSidebar } from '@web/contexts/sidebar-context';
import { cn } from '@web/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import Header from './header';
import Sidebar from './sidebar';

interface AppLayoutProps {
  children: ReactNode;
}

function AppLayoutInner({ children }: AppLayoutProps) {
  const { isCollapsed, toggle } = useSidebar();

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />

      {/* Toggle Button - Fixed position outside sidebar */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-label={isCollapsed ? '사이드바 열기' : '사이드바 닫기'}
        data-collapsed={isCollapsed}
        className={cn(
          'fixed top-14 z-50',
          'h-8 w-8 rounded-r-md rounded-l-none',
          'border border-l-0 bg-background',
          'hover:bg-accent',
          'transition-all duration-300 ease-in-out',
          'data-[collapsed=false]:left-sidebar',
          'data-[collapsed=true]:left-0'
        )}
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

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
