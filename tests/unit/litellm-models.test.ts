import { _resetCache, fetchOpenAIModelsFromLiteLLM } from '@worker/utils/litellm-models';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const LITELLM_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

const sampleRegistry: Record<string, { litellm_provider: string; mode?: string }> = {
  'gpt-4o': { litellm_provider: 'openai', mode: 'chat' },
  'gpt-4o-mini': { litellm_provider: 'openai', mode: 'chat' },
  'o1-preview': { litellm_provider: 'openai', mode: 'chat' },
  'text-embedding-3-small': { litellm_provider: 'openai', mode: 'embedding' },
  'claude-3-opus': { litellm_provider: 'anthropic', mode: 'chat' },
  'dall-e-3': { litellm_provider: 'openai', mode: 'image_generation' },
  'tts-1': { litellm_provider: 'openai', mode: 'audio_speech' },
  sample_spec: { litellm_provider: 'sample', mode: 'chat' },
};

function mockFetchSuccess(data: unknown = sampleRegistry) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function mockFetchFailure(status = 500) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve('Internal Server Error'),
  });
}

function mockFetchNetworkError() {
  return vi.fn().mockRejectedValue(new Error('Network error'));
}

describe('fetchOpenAIModelsFromLiteLLM', () => {
  beforeEach(() => {
    _resetCache();
    vi.stubGlobal('fetch', mockFetchSuccess());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and filters OpenAI chat/embedding models', async () => {
    const models = await fetchOpenAIModelsFromLiteLLM();

    expect(fetch).toHaveBeenCalledWith(
      LITELLM_URL,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(models).toEqual([
      { id: 'gpt-4o', owned_by: 'openai' },
      { id: 'gpt-4o-mini', owned_by: 'openai' },
      { id: 'o1-preview', owned_by: 'openai' },
      { id: 'text-embedding-3-small', owned_by: 'openai' },
    ]);
  });

  it('excludes non-openai providers', async () => {
    const models = await fetchOpenAIModelsFromLiteLLM();
    const ids = models.map((m) => m.id);

    expect(ids).not.toContain('claude-3-opus');
    expect(ids).not.toContain('sample_spec');
  });

  it('excludes non-chat/embedding modes', async () => {
    const models = await fetchOpenAIModelsFromLiteLLM();
    const ids = models.map((m) => m.id);

    expect(ids).not.toContain('dall-e-3');
    expect(ids).not.toContain('tts-1');
  });

  it('returns sorted results', async () => {
    const models = await fetchOpenAIModelsFromLiteLLM();
    const ids = models.map((m) => m.id);

    expect(ids).toEqual([...ids].sort());
  });

  describe('caching', () => {
    it('returns cached models on second call without re-fetching', async () => {
      await fetchOpenAIModelsFromLiteLLM();
      await fetchOpenAIModelsFromLiteLLM();

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('re-fetches after cache TTL expires', async () => {
      await fetchOpenAIModelsFromLiteLLM();

      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61 * 60 * 1000);
      await fetchOpenAIModelsFromLiteLLM();

      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('returns empty array on HTTP error with no cache', async () => {
      vi.stubGlobal('fetch', mockFetchFailure(500));

      const models = await fetchOpenAIModelsFromLiteLLM();

      expect(models).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[LiteLLM] HTTP 500'));
    });

    it('returns stale cache on HTTP error when cache exists', async () => {
      // Warm cache
      await fetchOpenAIModelsFromLiteLLM();

      // Expire cache and fail fetch
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61 * 60 * 1000);
      vi.stubGlobal('fetch', mockFetchFailure(403));

      const models = await fetchOpenAIModelsFromLiteLLM();

      expect(models.length).toBeGreaterThan(0);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[LiteLLM] HTTP 403'));
    });

    it('returns empty array on network error with no cache', async () => {
      vi.stubGlobal('fetch', mockFetchNetworkError());

      const models = await fetchOpenAIModelsFromLiteLLM();

      expect(models).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[LiteLLM] Failed to fetch models: Network error')
      );
    });

    it('returns stale cache on network error when cache exists', async () => {
      // Warm cache
      await fetchOpenAIModelsFromLiteLLM();

      // Expire cache and throw network error
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61 * 60 * 1000);
      vi.stubGlobal('fetch', mockFetchNetworkError());

      const models = await fetchOpenAIModelsFromLiteLLM();

      expect(models.length).toBeGreaterThan(0);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[LiteLLM] Failed to fetch models')
      );
    });

    it('logs warning when entries exist but no models match filters', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetchSuccess({
          'unknown-model': { litellm_provider: 'other', mode: 'chat' },
        })
      );

      const models = await fetchOpenAIModelsFromLiteLLM();

      expect(models).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('0 matched OpenAI filters')
      );
    });

    it('returns empty array on invalid JSON without cache', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.reject(new SyntaxError('Unexpected token')),
        })
      );

      const models = await fetchOpenAIModelsFromLiteLLM();

      expect(models).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[LiteLLM] Failed to fetch models')
      );
    });
  });
});
