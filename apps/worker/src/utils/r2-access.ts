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
    const environment = env.ENVIRONMENT || 'unknown';
    const errorMessage = [
      'R2_BUCKET is not configured.',
      '',
      `Environment: ${environment}`,
      '',
      'What to check:',
      '  • Production: Ensure R2_BUCKET binding is configured in wrangler.toml under [env.production]',
      '  • Development: Ensure R2_BUCKET binding is configured in wrangler.toml under [env.development]',
      '  • Testing: Set __TEST_R2_BUCKET on globalThis in test setup or mock before calling getR2Bucket()',
      '',
      'Example wrangler.toml configuration:',
      '  [env.production]',
      '  r2_buckets = [',
      '    { binding = "R2_BUCKET", bucket_name = "your-bucket-name" }',
      '  ]',
    ].join('\n');

    throw new Error(errorMessage);
  }

  return bucket;
}
