/**
 * Buffered SSE response utility.
 *
 * Wraps an async function in an SSE stream that sends heartbeat comments
 * to keep the Cloudflare Workers connection alive, then delivers the
 * final result as a single `data:` event.
 */

const DEFAULT_HEARTBEAT_INTERVAL_MS = 5_000;

// --- Agent SSE types ---

export interface AgentProgressEvent {
  step: 'analyzing' | 'tool_call' | 'tool_result' | 'synthesizing';
  tool?: string;
  message: string;
}

export type ProgressCallback = (event: AgentProgressEvent) => void;

/**
 * Run `work()` in the background while streaming SSE heartbeat comments
 * to the client. When the work completes, send the result as a single
 * JSON `data:` event followed by an `event: done` marker.
 *
 * If `work()` throws, an `event: error` is sent instead.
 */
export function createBufferedSSEResponse<T>(
  work: () => Promise<T>,
  options?: { heartbeatIntervalMs?: number }
): Response {
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const heartbeatMs = options?.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;

  const run = async () => {
    const heartbeat = setInterval(() => {
      writer.write(encoder.encode(': heartbeat\n\n')).catch(() => {});
    }, heartbeatMs);

    try {
      const result = await work();
      clearInterval(heartbeat);
      await writer.write(
        encoder.encode(`data: ${JSON.stringify(result)}\n\nevent: done\ndata: {}\n\n`)
      );
    } catch (err) {
      clearInterval(heartbeat);
      const message = err instanceof Error ? err.message : 'Internal server error';
      try {
        await writer.write(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`)
        );
      } catch {
        // writer may already be broken
      }
    } finally {
      await writer.close().catch(() => {});
    }
  };

  run().catch(() => {});

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * Like `createBufferedSSEResponse`, but passes a `sendProgress` callback
 * to `work()` so the agent loop can emit intermediate progress events.
 *
 * Progress events are sent as `event: progress` SSE messages.
 * The final result is sent as a `data:` event followed by `event: done`.
 */
export function createAgentSSEResponse<T>(
  work: (sendProgress: ProgressCallback) => Promise<T>,
  options?: { heartbeatIntervalMs?: number }
): Response {
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const heartbeatMs = options?.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;

  const sendProgress: ProgressCallback = (event) => {
    writer
      .write(encoder.encode(`event: progress\ndata: ${JSON.stringify(event)}\n\n`))
      .catch(() => {});
  };

  const run = async () => {
    const heartbeat = setInterval(() => {
      writer.write(encoder.encode(': heartbeat\n\n')).catch(() => {});
    }, heartbeatMs);

    try {
      const result = await work(sendProgress);
      clearInterval(heartbeat);
      await writer.write(
        encoder.encode(`data: ${JSON.stringify(result)}\n\nevent: done\ndata: {}\n\n`)
      );
    } catch (err) {
      clearInterval(heartbeat);
      const message = err instanceof Error ? err.message : 'Internal server error';
      try {
        await writer.write(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`)
        );
      } catch {
        // writer may already be broken
      }
    } finally {
      await writer.close().catch(() => {});
    }
  };

  run().catch(() => {});

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
