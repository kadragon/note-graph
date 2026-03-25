import { describe, expect, it, vi } from 'vitest';
import { createSSEProxy } from '../../apps/worker/src/utils/openai-chat';

function makeUpstreamResponse(body: string): Response {
  return new Response(body, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('createSSEProxy', () => {
  it('should include X-Accel-Buffering: no header', () => {
    const upstream = makeUpstreamResponse('data: [DONE]\n\n');
    const response = createSSEProxy(upstream);

    expect(response.headers.get('X-Accel-Buffering')).toBe('no');
  });

  it('should log model parameter in token usage', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const usageChunk = JSON.stringify({
      choices: [{ delta: {}, finish_reason: null }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });
    const body = `data: ${usageChunk}\ndata: [DONE]\n\n`;
    const upstream = makeUpstreamResponse(body);

    const response = createSSEProxy(upstream, 'gpt-4o');

    // Consume the stream to trigger the pump
    const reader = response.body?.getReader();
    while (!(await reader.read()).done) {}

    expect(consoleSpy).toHaveBeenCalledWith('[OpenAI Stream] Token usage:', {
      model: 'gpt-4o',
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    });

    consoleSpy.mockRestore();
  });
});
