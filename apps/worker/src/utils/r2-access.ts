// Trace: SPEC-refactor-r2-init, TASK-REFACTOR-001
/**
 * R2 Bucket Access Utility
 *
 * Provides a single source of truth for R2 bucket initialization,
 * supporting both production and test environments.
 */

import type { Env } from '../types/env';

/**
 * Global interface for test environment R2 bucket access
 */
interface GlobalWithTestBucket {
  __TEST_R2_BUCKET?: R2Bucket;
}

/**
 * Get R2 bucket from environment or test global
 *
 * In production: Uses c.env.R2_BUCKET
 * In tests: Falls back to globalThis.__TEST_R2_BUCKET
 *
 * @param env - Cloudflare Workers environment bindings
 * @returns R2Bucket instance
 * @throws Error if R2_BUCKET is not configured in either location
 */
export function getR2Bucket(env: Env): R2Bucket {
  const bucket = env.R2_BUCKET || (globalThis as unknown as GlobalWithTestBucket).__TEST_R2_BUCKET;

  if (!bucket) {
    throw new Error('R2_BUCKET not configured');
  }

  return bucket;
}
