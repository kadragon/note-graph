import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook for managing sidebar collapse state with localStorage persistence
 * and keyboard shortcut support (Cmd+B / Ctrl+B)
 *
 * SSR-safe implementation:
 * - Server and client both render with isCollapsed=false initially
 * - Client reads localStorage in useEffect after hydration
 * - Prevents hydration mismatch errors
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
  // Always initialize to false for SSR compatibility
  // Server and client will render identically on first pass
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Track initialization to prevent overwriting stored value
  const isInitialized = useRef(false);

  // Read from localStorage after component mounts (client-side only)
  useEffect(() => {
    if (!isInitialized.current) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) {
          setIsCollapsed(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Failed to load sidebar state:', error);
      }
      isInitialized.current = true;
    }
  }, []);

  // Persist to localStorage only after initialization
  useEffect(() => {
    if (isInitialized.current) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(isCollapsed));
      } catch (error) {
        console.error('Failed to save sidebar state:', error);
      }
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
