/**
 * Parse a buffered SSE response body into the final JSON result.
 * Ignores heartbeat comments (`:`) and `event: done` markers.
 * Throws if an `event: error` is found.
 */
export async function parseBufferedSSE<T>(response: Response): Promise<T> {
  const text = await response.text();
  const lines = text.split('\n');
  let result: T | undefined;
  let currentEventType: string | null = null;

  for (const line of lines) {
    if (line.startsWith(':')) {
      continue;
    }
    if (line === '') {
      currentEventType = null;
      continue;
    }
    if (line.startsWith('event: ')) {
      currentEventType = line.slice(7);
      continue;
    }
    if (line.startsWith('data: ')) {
      const payload = line.slice(6);
      if (currentEventType === 'error') {
        let message = payload;
        try {
          const errData = JSON.parse(payload) as { message?: string };
          if (errData.message) message = errData.message;
        } catch {
          // use raw payload
        }
        throw new Error(`SSE error: ${message}`);
      }
      if (currentEventType === 'done') {
        continue;
      }
      result = JSON.parse(payload) as T;
    }
  }

  if (result === undefined) {
    throw new Error('No result found in SSE response');
  }
  return result;
}
