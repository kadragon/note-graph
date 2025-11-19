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

/**
 * Get AI Gateway URL for OpenAI API endpoints
 *
 * Constructs the full URL for OpenAI API calls through Cloudflare AI Gateway.
 * Format: https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai/{endpoint}
 *
 * @param env - Cloudflare Workers environment
 * @param endpoint - OpenAI API endpoint (e.g., 'chat/completions', 'embeddings')
 * @returns Full AI Gateway URL
 *
 * @example
 * getAIGatewayUrl(env, 'chat/completions')
 * // Returns: https://gateway.ai.cloudflare.com/v1/abc123/my-gateway/openai/chat/completions
 */
export function getAIGatewayUrl(env: Env, endpoint: string): string {
  const baseUrl = `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.AI_GATEWAY_ID}/openai`;
  return `${baseUrl}/${endpoint}`;
}
