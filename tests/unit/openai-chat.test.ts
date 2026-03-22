import { describe, expect, it } from 'vitest';
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
});
