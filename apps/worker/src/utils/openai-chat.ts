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
