/**
 * Cloudflare AI Gateway utilities
 */

import type { Env } from '../types/env';

/**
 * Get headers for Cloudflare AI Gateway requests
 *
 * Includes:
 * - Content-Type: application/json
 * - Authorization: Bearer token for OpenAI API
 * - cf-aig-authorization: Optional Cloudflare AI Gateway authorization
 *
 * @param env - Cloudflare Workers environment
 * @returns Headers object for AI Gateway requests
 */
export function getAIGatewayHeaders(env: Env): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.OPENAI_API_KEY}`,
  };

  // Add Cloudflare AI Gateway authorization if configured
  if (env.CF_AIG_AUTHORIZATION) {
    headers['cf-aig-authorization'] = `Bearer ${env.CF_AIG_AUTHORIZATION}`;
  }

  return headers;
}
