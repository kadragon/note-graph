// Trace: SPEC-ai-gateway-logs-1, TASK-ai-gateway-logs-1
/**
 * Shared types for Cloudflare AI Gateway log listing.
 * Metadata-only contract: prompt/response payload bodies are intentionally excluded.
 */

export type AIGatewayLogOrder = 'asc' | 'desc';
export type AIGatewayLogOrderBy = 'created_at' | 'started_at';

export interface AIGatewayLogItem {
  id: string;
  createdAt: string;
  startedAt: string | null;
  provider: string | null;
  model: string | null;
  path: string | null;
  requestType: string | null;
  statusCode: number | null;
  success: boolean;
  tokensIn: number | null;
  tokensOut: number | null;
  event: string | null;
  cached: boolean | null;
}

export interface AIGatewayLogsPagination {
  page: number;
  perPage: number;
  count: number;
  totalCount: number;
  totalPages: number;
}

export interface AIGatewayLogsResponse {
  logs: AIGatewayLogItem[];
  pagination: AIGatewayLogsPagination;
}
