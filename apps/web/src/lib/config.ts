// =============================================================================
// Centralized Application Configuration
// All magic numbers and timing values consolidated here for maintainability
// =============================================================================

// -----------------------------------------------------------------------------
// React Query Defaults
// -----------------------------------------------------------------------------
export const QUERY_CONFIG = {
  /** Default stale time for query data (5 minutes) */
  DEFAULT_STALE_TIME_MS: 5 * 60 * 1000,

  /** Short stale time for frequently updated data (30 seconds) */
  SHORT_STALE_TIME_MS: 30_000,

  /** Auth query stale time (1 minute) */
  AUTH_STALE_TIME_MS: 60 * 1000,

  /** Default garbage collection time (5 minutes) */
  DEFAULT_GC_TIME_MS: 5 * 60 * 1000,

  /** Default retry count for failed queries */
  DEFAULT_RETRY_COUNT: 1,

  /** Whether to refetch on window focus by default */
  REFETCH_ON_WINDOW_FOCUS: false,
} as const;

// -----------------------------------------------------------------------------
// Search Configuration
// -----------------------------------------------------------------------------
export const SEARCH_CONFIG = {
  /** Debounce delay for search inputs (milliseconds) */
  DEBOUNCE_MS: 250,

  /** Maximum number of department suggestions to show */
  DEPARTMENT_LIMIT: 5,
} as const;

// -----------------------------------------------------------------------------
// Cloudflare Access Token Refresh
// -----------------------------------------------------------------------------
export const CF_ACCESS_CONFIG = {
  /** Cooldown between refresh attempts (5 seconds) */
  REFRESH_COOLDOWN_MS: 5000,

  /** Time for CF Access to set cookie after iframe load */
  COOKIE_SET_DELAY_MS: 1000,

  /** Fallback timeout for refresh operation */
  REFRESH_TIMEOUT_MS: 5000,

  /** Maximum consecutive failures before redirect to login */
  MAX_CONSECUTIVE_FAILURES: 2,

  /** Timeout for checking authentication status */
  AUTH_CHECK_TIMEOUT_MS: 3000,
} as const;

// -----------------------------------------------------------------------------
// PWA Configuration
// -----------------------------------------------------------------------------
export const PWA_CONFIG = {
  /** Interval for checking service worker updates (1 hour) */
  UPDATE_CHECK_INTERVAL_MS: 60 * 60 * 1000,
} as const;

// -----------------------------------------------------------------------------
// UI Configuration
// -----------------------------------------------------------------------------
export const UI_CONFIG = {
  /** Maximum number of toasts to show simultaneously */
  TOAST_LIMIT: 1,

  /** Default toast auto-dismiss duration (5 seconds) */
  TOAST_DURATION_MS: 5000,
} as const;

// -----------------------------------------------------------------------------
// API Configuration
// -----------------------------------------------------------------------------
export const API_CONFIG = {
  /** Base timeout for API requests (30 seconds) */
  REQUEST_TIMEOUT_MS: 30_000,

  /** Polling interval for job status checks (3 seconds) */
  JOB_POLL_INTERVAL_MS: 3000,
} as const;

// -----------------------------------------------------------------------------
// File Upload Configuration
// -----------------------------------------------------------------------------
export const FILE_UPLOAD_CONFIG = {
  /** Maximum file size in bytes (10MB) */
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,

  /** Maximum file size in MB for display */
  MAX_FILE_SIZE_MB: 10,
} as const;

// -----------------------------------------------------------------------------
// Legacy Exports (for backward compatibility with constants/search.ts)
// These re-export from SEARCH_CONFIG for files still using the old imports
// -----------------------------------------------------------------------------
export const SEARCH_DEBOUNCE_MS = SEARCH_CONFIG.DEBOUNCE_MS;
export const DEPARTMENT_SEARCH_LIMIT = SEARCH_CONFIG.DEPARTMENT_LIMIT;
