/**
 * Fetch OpenAI model list from LiteLLM's model registry.
 *
 * AI Gateway fails when proxying OpenAI's /models endpoint (returns internal error),
 * and direct OpenAI API calls are unreliable from the deployment region.
 * LiteLLM maintains a model registry on GitHub, which we fetch and filter.
 */

import type { OpenAIModel } from '@shared/types/setting';

const LITELLM_MODELS_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FETCH_TIMEOUT_MS = 5000;

interface LiteLLMModelEntry {
  litellm_provider: string;
  mode?: string;
}

// In-memory cache (per Worker isolate; may reset on isolate recycle)
let cachedModels: OpenAIModel[] | null = null;
let cachedAt = 0;

/** Visible for testing */
export function _resetCache(): void {
  cachedModels = null;
  cachedAt = 0;
}

export async function fetchOpenAIModelsFromLiteLLM(): Promise<OpenAIModel[]> {
  const now = Date.now();
  if (cachedModels && now - cachedAt < CACHE_TTL_MS) {
    return cachedModels;
  }

  try {
    const response = await fetch(LITELLM_MODELS_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '(unreadable body)');
      console.error(
        `[LiteLLM] HTTP ${response.status} fetching models: ${errorText.slice(0, 200)}`
      );
      if (cachedModels) return cachedModels;
      return [];
    }

    const data = await response.json<Record<string, LiteLLMModelEntry>>();

    // Keep only GPT, O-series, and text-embedding models
    const models: OpenAIModel[] = Object.entries(data)
      .filter(([key, entry]) => {
        if (entry.litellm_provider !== 'openai') return false;
        if (!entry.mode || (entry.mode !== 'chat' && entry.mode !== 'embedding')) return false;
        return /^(gpt-|o[1-9]|text-embedding-)/.test(key);
      })
      .map(([key]) => ({ id: key, owned_by: 'openai' }))
      .sort((a, b) => a.id.localeCompare(b.id));

    if (models.length === 0 && Object.keys(data).length > 0) {
      console.error(
        `[LiteLLM] Parsed ${Object.keys(data).length} entries but 0 matched OpenAI filters — schema may have changed`
      );
    }

    cachedModels = models;
    cachedAt = now;

    return models;
  } catch (error) {
    console.error(
      `[LiteLLM] Failed to fetch models: ${error instanceof Error ? error.message : String(error)}`
    );
    if (cachedModels) {
      const stalenessMin = Math.round((now - cachedAt) / 1000 / 60);
      console.error(`[LiteLLM] Serving stale cache (${stalenessMin}m old)`);
      return cachedModels;
    }
    return [];
  }
}
