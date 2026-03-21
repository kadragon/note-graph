/**
 * Common utility for OpenAI chat completions via AI Gateway
 */

import type { Env } from '../types/env';
import { AIResponseError, RateLimitError, ValidationError } from '../types/errors';
import { getAIGatewayHeaders, getAIGatewayUrl, isReasoningModel } from './ai-gateway';

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIChatOptions {
  messages: OpenAIChatMessage[];
  model: string;
  maxCompletionTokens: number;
  temperature?: number;
  responseFormat?: { type: 'json_object' };
  timeoutMs?: number;
}

/**
 * Call OpenAI chat completions API via AI Gateway
 *
 * Handles:
 * - Rate limit errors (429)
 * - Empty responses
 * - finish_reason: 'length' truncation
 * - Usage logging
 *
 * @returns The response content string
 */
export async function callOpenAIChat(env: Env, options: OpenAIChatOptions): Promise<string> {
  const url = getAIGatewayUrl(env, 'chat/completions');

  const requestBody = {
    model: options.model,
    messages: options.messages,
    max_completion_tokens: options.maxCompletionTokens,
    ...(options.responseFormat && { response_format: options.responseFormat }),
    // Reasoning models (o1, o3, gpt-5) don't support temperature parameter
    ...(!isReasoningModel(options.model) && {
      temperature: options.temperature ?? 0.7,
    }),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: getAIGatewayHeaders(env),
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(options.timeoutMs ?? 90_000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) {
      throw new RateLimitError('AI 호출 상한을 초과했습니다. 잠시 후 다시 시도해주세요.');
    }
    throw new AIResponseError(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json<{
    choices: Array<{
      message: { content: string | null };
      finish_reason: string;
    }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }>();

  if (data.usage) {
    console.log('[OpenAI] Token usage:', {
      model: options.model,
      prompt_tokens: data.usage.prompt_tokens,
      completion_tokens: data.usage.completion_tokens,
      total_tokens: data.usage.total_tokens,
    });
  }

  if (!data.choices?.[0]?.message?.content) {
    const finishReason = data.choices?.[0]?.finish_reason;
    console.error('[OpenAI] Empty response', {
      finish_reason: finishReason,
      usage: data.usage,
      choicesLength: data.choices?.length,
    });

    if (finishReason === 'length') {
      throw new ValidationError('AI 응답이 너무 길어 완료되지 못했습니다. 입력을 줄여주세요.');
    }
    throw new AIResponseError('AI로부터 응답을 받지 못했습니다. 다시 시도해주세요.');
  }

  return data.choices[0].message.content;
}

/**
 * Call OpenAI chat completions API via AI Gateway with streaming enabled.
 *
 * Returns the raw upstream Response whose body is an SSE ReadableStream.
 * Caller is responsible for piping/transforming the stream.
 *
 * Throws the same errors as callOpenAIChat for non-2xx responses.
 */
export async function callOpenAIChatStream(
  env: Env,
  options: OpenAIChatOptions
): Promise<Response> {
  const url = getAIGatewayUrl(env, 'chat/completions');

  const requestBody = {
    model: options.model,
    messages: options.messages,
    max_completion_tokens: options.maxCompletionTokens,
    stream: true,
    stream_options: { include_usage: true },
    ...(options.responseFormat && { response_format: options.responseFormat }),
    ...(!isReasoningModel(options.model) && {
      temperature: options.temperature ?? 0.7,
    }),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: getAIGatewayHeaders(env),
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(options.timeoutMs ?? 90_000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) {
      throw new RateLimitError('AI 호출 상한을 초과했습니다. 잠시 후 다시 시도해주세요.');
    }
    throw new AIResponseError(`OpenAI API error (${response.status}): ${errorText}`);
  }

  return response;
}

/**
 * Transform an OpenAI SSE stream into a simplified SSE stream for the client.
 *
 * Input (OpenAI):  data: {"choices":[{"delta":{"content":"tok"}}]}
 * Output (client): data: tok
 *
 * On finish:       event: done\ndata: {}
 * On truncation:   event: error\ndata: {"message":"..."}
 */
export function createSSEProxy(upstreamResponse: Response): Response {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const pump = async () => {
    if (!upstreamResponse.body) {
      throw new Error('Upstream response has no body.');
    }
    const reader = upstreamResponse.body.getReader();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!;

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') {
            await writer.write(encoder.encode('event: done\ndata: {}\n\n'));
            continue;
          }

          try {
            const chunk = JSON.parse(payload) as {
              choices?: Array<{
                delta?: { content?: string };
                finish_reason?: string | null;
              }>;
              usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
            };

            if (chunk.usage) {
              console.log('[OpenAI Stream] Token usage:', chunk.usage);
            }

            const choice = chunk.choices?.[0];
            if (choice?.finish_reason === 'length') {
              await writer.write(
                encoder.encode(
                  `event: error\ndata: ${JSON.stringify({ message: 'AI 응답이 너무 길어 완료되지 못했습니다.' })}\n\n`
                )
              );
              continue;
            }

            const token = choice?.delta?.content;
            if (token) {
              await writer.write(encoder.encode(`data: ${JSON.stringify(token)}\n\n`));
            }
          } catch (e) {
            console.error('[SSE Proxy] Failed to parse stream chunk:', { payload, error: e });
          }
        }
      }
      await writer.close();
    } catch (err) {
      console.error('[SSE Proxy] Stream error:', err);
      try {
        await writer.write(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ message: 'Stream interrupted' })}\n\n`
          )
        );
      } catch {
        // writer may already be broken
      }
      await writer.abort(err).catch(() => {});
    }
  };

  pump().catch(() => {});

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
