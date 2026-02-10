// Trace: SPEC-ai-gateway-logs-1, TASK-ai-gateway-logs-1
/**
 * Cloudflare AI Gateway logs proxy service.
 * Uses Cloudflare Account API and returns metadata-only log entries.
 */

import type {
  AIGatewayLogItem,
  AIGatewayLogsPagination,
  AIGatewayLogsResponse,
} from '@shared/types/ai-gateway-log';
import type { AIGatewayLogsQuery } from '../schemas/ai-gateway-logs';
import type { Env } from '../types/env';
import { DomainError } from '../types/errors';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

type CloudflareApiResponse = {
  success?: boolean;
  errors?: unknown;
  result?: unknown;
  result_info?: unknown;
};

type CloudflareLogPayload = Record<string, unknown>;

export class CloudflareAIGatewayLogService {
  constructor(private env: Env) {}

  async listLogs(query: AIGatewayLogsQuery): Promise<AIGatewayLogsResponse> {
    const token = this.env.CLOUDFLARE_API_TOKEN;
    if (!token) {
      throw new DomainError('Cloudflare API token is not configured.', 'CONFIGURATION_ERROR', 500);
    }

    const params = new URLSearchParams({
      page: query.page.toString(),
      per_page: query.perPage.toString(),
      order: query.order,
      order_by: query.orderBy,
    });

    if (query.search) {
      params.set('search', query.search);
    }
    if (query.startDate) {
      params.set('start_date', query.startDate);
    }
    if (query.endDate) {
      params.set('end_date', query.endDate);
    }

    const url = `${CLOUDFLARE_API_BASE}/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/ai-gateway/gateways/${this.env.AI_GATEWAY_ID}/logs?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 429) {
        throw new DomainError(
          'Cloudflare API rate limit exceeded.',
          'RATE_LIMIT_EXCEEDED',
          429,
          errorText
        );
      }

      if (response.status === 401 || response.status === 403) {
        throw new DomainError(
          'Cloudflare API authentication failed.',
          'UPSTREAM_AUTH_ERROR',
          502,
          errorText
        );
      }

      throw new DomainError('Cloudflare API request failed.', 'UPSTREAM_API_ERROR', 502, errorText);
    }

    const payload = (await response.json()) as CloudflareApiResponse;
    if (payload.success === false) {
      throw new DomainError(
        'Cloudflare API responded with an error.',
        'UPSTREAM_API_ERROR',
        502,
        payload.errors
      );
    }

    const result = this.getResultContainer(payload.result);
    const rawLogs = this.getRawLogs(result);
    const logs = rawLogs.map((entry, index) => this.mapLogItem(entry, index));

    const paginationSource = this.getPaginationSource(payload, result);
    const pagination = this.mapPagination(paginationSource, query.page, query.perPage, logs.length);

    return { logs, pagination };
  }

  private getResultContainer(result: unknown): Record<string, unknown> {
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      return result as Record<string, unknown>;
    }
    return {};
  }

  private getRawLogs(result: Record<string, unknown>): CloudflareLogPayload[] {
    if (Array.isArray(result.logs)) {
      return result.logs as CloudflareLogPayload[];
    }

    if (Array.isArray(result.result)) {
      return result.result as CloudflareLogPayload[];
    }

    if (Array.isArray(result.items)) {
      return result.items as CloudflareLogPayload[];
    }

    if (Array.isArray(result)) {
      return result as unknown as CloudflareLogPayload[];
    }

    return [];
  }

  private getPaginationSource(
    payload: CloudflareApiResponse,
    result: Record<string, unknown>
  ): Record<string, unknown> {
    if (result.pagination && typeof result.pagination === 'object') {
      return result.pagination as Record<string, unknown>;
    }

    if (result.result_info && typeof result.result_info === 'object') {
      return result.result_info as Record<string, unknown>;
    }

    if (payload.result_info && typeof payload.result_info === 'object') {
      return payload.result_info as Record<string, unknown>;
    }

    return {};
  }

  private mapPagination(
    raw: Record<string, unknown>,
    fallbackPage: number,
    fallbackPerPage: number,
    fallbackCount: number
  ): AIGatewayLogsPagination {
    const page = this.toNumber(raw.page) ?? fallbackPage;
    const perPage = this.toNumber(raw.per_page) ?? this.toNumber(raw.perPage) ?? fallbackPerPage;
    const count =
      this.toNumber(raw.count) ??
      this.toNumber(raw.result_count) ??
      this.toNumber(raw.items) ??
      fallbackCount;
    const totalCount =
      this.toNumber(raw.total_count) ??
      this.toNumber(raw.total) ??
      this.toNumber(raw.totalCount) ??
      count;
    const totalPages =
      this.toNumber(raw.total_pages) ??
      this.toNumber(raw.totalPages) ??
      Math.max(1, Math.ceil(totalCount / Math.max(1, perPage)));

    return {
      page,
      perPage,
      count,
      totalCount,
      totalPages,
    };
  }

  private mapLogItem(raw: CloudflareLogPayload, index: number): AIGatewayLogItem {
    const createdAt =
      this.toStringOrNull(raw.created_at) ??
      this.toStringOrNull(raw.createdAt) ??
      this.toStringOrNull(raw.timestamp) ??
      new Date().toISOString();
    const startedAt = this.toStringOrNull(raw.started_at) ?? this.toStringOrNull(raw.startedAt);

    const statusCode =
      this.toNumber(raw.status_code) ??
      this.toNumber(raw.statusCode) ??
      this.toNumber(raw.response_status) ??
      this.toNumber(this.getNested(raw, ['response', 'status']));

    const provider =
      this.toStringOrNull(raw.provider) ??
      this.toStringOrNull(this.getNested(raw, ['request', 'provider']));

    const model =
      this.toStringOrNull(raw.model) ??
      this.toStringOrNull(this.getNested(raw, ['request', 'model']));
    const path =
      this.toStringOrNull(raw.path) ??
      this.toStringOrNull(this.getNested(raw, ['request', 'path']));
    const requestType =
      this.toStringOrNull(raw.request_type) ??
      this.toStringOrNull(raw.requestType) ??
      this.toStringOrNull(raw.method) ??
      this.toStringOrNull(this.getNested(raw, ['request', 'method']));

    const tokensIn =
      this.toNumber(raw.tokens_in) ??
      this.toNumber(raw.input_tokens) ??
      this.toNumber(raw.prompt_tokens) ??
      this.toNumber(raw.request_tokens) ??
      this.toNumber(this.getNested(raw, ['usage', 'prompt_tokens'])) ??
      this.toNumber(this.getNested(raw, ['usage', 'input_tokens']));

    const tokensOut =
      this.toNumber(raw.tokens_out) ??
      this.toNumber(raw.output_tokens) ??
      this.toNumber(raw.completion_tokens) ??
      this.toNumber(raw.response_tokens) ??
      this.toNumber(this.getNested(raw, ['usage', 'completion_tokens'])) ??
      this.toNumber(this.getNested(raw, ['usage', 'output_tokens']));

    const success =
      this.toBoolean(raw.success) ??
      (statusCode !== null
        ? statusCode < 400
        : (this.toBoolean(this.getNested(raw, ['response', 'ok'])) ?? false));

    return {
      id:
        this.toStringOrNull(raw.id) ??
        this.toStringOrNull(raw.request_id) ??
        this.toStringOrNull(raw.requestId) ??
        `${createdAt}-${index}`,
      createdAt,
      startedAt,
      provider,
      model,
      path,
      requestType,
      statusCode,
      success,
      tokensIn,
      tokensOut,
      event: this.toStringOrNull(raw.event) ?? this.toStringOrNull(raw.operation),
      cached:
        this.toBoolean(raw.cached) ??
        this.toBoolean(this.getNested(raw, ['cache', 'cached'])) ??
        this.cacheStatusToBoolean(this.toStringOrNull(raw.cache_status)),
    };
  }

  private cacheStatusToBoolean(value: string | null): boolean | null {
    if (!value) return null;
    const normalized = value.toLowerCase();
    if (normalized === 'hit' || normalized === 'cached') return true;
    if (normalized === 'miss' || normalized === 'bypass') return false;
    return null;
  }

  private getNested(source: Record<string, unknown>, path: string[]): unknown {
    let current: unknown = source;
    for (const key of path) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  private toStringOrNull(value: unknown): string | null {
    if (typeof value === 'string') return value;
    return null;
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private toBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
    }
    return null;
  }
}
