// Trace: SPEC-auth-1, TASK-003
/**
 * Authentication types and interfaces
 */

/**
 * Authenticated user information extracted from Cloudflare Access headers
 */
export interface AuthUser {
  email: string;
  name?: string;
  id?: string;
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
