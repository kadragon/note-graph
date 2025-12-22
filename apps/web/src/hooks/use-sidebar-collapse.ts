import { useCallback, useEffect, useState } from 'react';

/**
 * Hook for managing sidebar collapse state with localStorage persistence
 * and keyboard shortcut support (Cmd+B / Ctrl+B)
 *
 * Trace:
 *   spec_id: SPEC-collapsible-sidebar-1
 *   task_id: TASK-sidebar-001
 *
 * @returns {Object} Sidebar state and controls
 * @property {boolean} isCollapsed - Current collapsed state
 * @property {Function} toggle - Toggle function
 * @property {Function} setIsCollapsed - Direct state setter
 */

const STORAGE_KEY = 'sidebar-collapsed';

export function useSidebarCollapse() {
  // Initialize from localStorage with fallback to false
  // Using lazy initialization to avoid SSR issues
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : false;
    } catch {
      // Handle localStorage errors gracefully (quota exceeded, SSR, etc.)
      return false;
    }
  });

  // Persist to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(isCollapsed));
    } catch (error) {
      console.error('Failed to save sidebar state:', error);
    }
  }, [isCollapsed]);

  // Toggle function - memoized to prevent unnecessary re-renders
  const toggle = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  // Keyboard shortcut handler (Cmd+B / Ctrl+B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+B (Mac) or Ctrl+B (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault(); // Prevent browser bookmark dialog
        toggle();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Cleanup listener on unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggle]);

  return {
    isCollapsed,
    toggle,
    setIsCollapsed,
  };
}
