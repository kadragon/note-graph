/**
 * Fetch OpenAI model list from LiteLLM's community-maintained model registry.
 *
 * AI Gateway does not proxy OpenAI's /models endpoint, and direct calls
 * are blocked by region. LiteLLM maintains an up-to-date JSON of 2,500+
 * models on GitHub, which we fetch and filter for OpenAI models.
 */

import type { OpenAIModel } from '@shared/types/setting';

const LITELLM_MODELS_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface LiteLLMModelEntry {
  litellm_provider: string;
  mode?: string;
}

let cachedModels: OpenAIModel[] | null = null;
let cachedAt = 0;

export async function fetchOpenAIModelsFromLiteLLM(): Promise<OpenAIModel[]> {
  const now = Date.now();
  if (cachedModels && now - cachedAt < CACHE_TTL_MS) {
    return cachedModels;
  }

  const response = await fetch(LITELLM_MODELS_URL);
  if (!response.ok) {
    if (cachedModels) return cachedModels;
    return [];
  }

  const data = await response.json<Record<string, LiteLLMModelEntry>>();

  const models: OpenAIModel[] = Object.entries(data)
    .filter(([key, entry]) => {
      if (entry.litellm_provider !== 'openai') return false;
      if (!entry.mode || (entry.mode !== 'chat' && entry.mode !== 'embedding')) return false;
      // Filter to GPT/O-series/embedding models only
      return /^(gpt-|o[1-9]|text-embedding-)/.test(key);
    })
    .map(([key]) => ({ id: key, owned_by: 'openai' }))
    .sort((a, b) => a.id.localeCompare(b.id));

  cachedModels = models;
  cachedAt = now;

  return models;
}
