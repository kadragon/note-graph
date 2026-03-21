import { describe, expect, it } from 'vitest';
import { createBufferedSSEResponse } from '../../apps/worker/src/utils/buffered-sse';

/** Parse a buffered SSE response into its constituent events */
async function parseSSE(response: Response): Promise<{
  heartbeats: number;
  result?: unknown;
  error?: string;
  hasDone: boolean;
}> {
  const text = await response.text();
  const lines = text.split('\n');
  let heartbeats = 0;
  let result: unknown;
  let error: string | undefined;
  let hasDone = false;
  let currentEventType: string | null = null;

  for (const line of lines) {
    if (line.startsWith(':')) {
      heartbeats++;
      continue;
    }
    if (line.startsWith('event: ')) {
      currentEventType = line.slice(7);
      continue;
    }
    if (line.startsWith('data: ')) {
      const payload = line.slice(6);
      if (currentEventType === 'error') {
        try {
          const errData = JSON.parse(payload) as { message?: string };
          error = errData.message ?? payload;
        } catch {
          error = payload;
        }
      } else if (currentEventType === 'done') {
        hasDone = true;
      } else {
        try {
          result = JSON.parse(payload);
        } catch {
          // skip
        }
      }
      currentEventType = null;
    }
    if (line === '') {
      currentEventType = null;
    }
  }

  return { heartbeats, result, error, hasDone };
}

describe('createBufferedSSEResponse', () => {
  it('returns result as SSE data event followed by done', async () => {
    const response = createBufferedSSEResponse(async () => ({ foo: 'bar' }));

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');

    const parsed = await parseSSE(response);
    expect(parsed.result).toEqual({ foo: 'bar' });
    expect(parsed.hasDone).toBe(true);
    expect(parsed.error).toBeUndefined();
  });

  it('sends heartbeat comments while work is pending', async () => {
    const response = createBufferedSSEResponse(
      () => new Promise((resolve) => setTimeout(() => resolve('ok'), 120)),
      { heartbeatIntervalMs: 30 }
    );

    const parsed = await parseSSE(response);
    expect(parsed.heartbeats).toBeGreaterThanOrEqual(2);
    expect(parsed.result).toBe('ok');
    expect(parsed.hasDone).toBe(true);
  });

  it('sends error event when work throws', async () => {
    const response = createBufferedSSEResponse(async () => {
      throw new Error('something broke');
    });

    const parsed = await parseSSE(response);
    expect(parsed.error).toBe('something broke');
    expect(parsed.result).toBeUndefined();
  });

  it('handles non-Error throws', async () => {
    const response = createBufferedSSEResponse(async () => {
      throw 'string error';
    });

    const parsed = await parseSSE(response);
    expect(parsed.error).toBe('Internal server error');
  });
});
