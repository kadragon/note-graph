// Trace: SPEC-ai-draft-1
/**
 * Date utility functions for consistent date handling across the application
 */

/**
 * Get today's date in YYYY-MM-DD format using UTC
 * Uses UTC to ensure consistent dates regardless of server timezone
 *
 * @returns Today's date as YYYY-MM-DD string
 */
export function getTodayDateUTC(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
