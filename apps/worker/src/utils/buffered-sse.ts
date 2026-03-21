/**
 * Buffered SSE response utility.
 *
 * Wraps an async function in an SSE stream that sends heartbeat comments
 * to keep the Cloudflare Workers connection alive, then delivers the
 * final result as a single `data:` event.
 */

const DEFAULT_HEARTBEAT_INTERVAL_MS = 5_000;

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
