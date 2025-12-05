// Trace: SPEC-auth-1, TASK-003
/**
 * Authentication types and interfaces
 */

/**
 * Authenticated user information extracted from Cloudflare Access headers
 */
export interface AuthUser {
  /**
   * User email from Cf-Access-Authenticated-User-Email header
   */
  email: string;

  /**
   * Optional user name (can be extracted from JWT if needed)
   */
  name?: string;
}

/**
 * Authentication error types
 */
export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}
