import { useSidebarCollapse } from '@web/hooks/use-sidebar-collapse';
import { createContext, type ReactNode, useContext } from 'react';

/**
 * Context for sharing sidebar collapse state between components
 *
 * Trace:
 *   spec_id: SPEC-collapsible-sidebar-1
 *   task_id: TASK-sidebar-002
 */

interface SidebarContextValue {
  isCollapsed: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const sidebarState = useSidebarCollapse();

  return <SidebarContext.Provider value={sidebarState}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }

  return context;
}
