import type { Env } from '../types/env';
import { RateLimitError } from '../types/errors';
import { getAIGatewayHeaders, getAIGatewayUrl, isReasoningModel } from '../utils/ai-gateway';

interface ExtractKeywordsInput {
  topic: string;
  detailsRaw: string;
}

interface KeywordResponse {
  keywords?: unknown;
}

export class MeetingMinuteKeywordService {
  private static readonly GPT_MAX_COMPLETION_TOKENS = 400;
  private static readonly MAX_KEYWORDS = 10;

  constructor(private env: Env) {}

  async extractKeywords(input: ExtractKeywordsInput): Promise<string[]> {
    const fallbackKeywords = this.extractDeterministicKeywords(input);

    try {
      const prompt = this.constructPrompt(input);
      const response = await this.callGPT(prompt);
      const parsed = JSON.parse(response) as KeywordResponse;
      const normalized = this.normalizeKeywords(parsed.keywords);
      return normalized.length > 0 ? normalized : fallbackKeywords;
    } catch {
      return fallbackKeywords;
    }
  }

  private constructPrompt(input: ExtractKeywordsInput): string {
    return `다음 회의 정보를 바탕으로 핵심 키워드를 추출하세요.

주제: ${input.topic}
내용: ${input.detailsRaw}

반드시 JSON으로만 응답하세요:
{
  "keywords": ["키워드1", "키워드2", "키워드3"]
}`;
  }

  private async callGPT(prompt: string): Promise<string> {
    const url = getAIGatewayUrl(this.env, 'chat/completions');
    const model = this.env.OPENAI_MODEL_LIGHTWEIGHT;

    const requestBody = {
      model,
      messages: [{ role: 'user' as const, content: prompt }],
      max_completion_tokens: MeetingMinuteKeywordService.GPT_MAX_COMPLETION_TOKENS,
      response_format: { type: 'json_object' as const },
      ...(!isReasoningModel(model) && { temperature: 0.1 }),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: getAIGatewayHeaders(this.env),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 429) {
        throw new RateLimitError('AI 호출 상한을 초과했습니다. 잠시 후 다시 시도해주세요.');
      }
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json<{
      choices: Array<{ message: { content: string } }>;
    }>();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT');
    }
    return content;
  }

  private normalizeKeywords(rawKeywords: unknown): string[] {
    if (!Array.isArray(rawKeywords)) {
      return [];
    }

    const normalized: string[] = [];
    const seen = new Set<string>();

    for (const raw of rawKeywords) {
      if (typeof raw !== 'string') {
        continue;
      }

      const keyword = raw.trim().replace(/^#+/, '').replace(/\s+/g, ' ').toLowerCase();

      if (!keyword || seen.has(keyword)) {
        continue;
      }

      seen.add(keyword);
      normalized.push(keyword);

      if (normalized.length >= MeetingMinuteKeywordService.MAX_KEYWORDS) {
        break;
      }
    }

    return normalized;
  }

  private extractDeterministicKeywords(input: ExtractKeywordsInput): string[] {
    const normalizedText = `${input.topic} ${input.detailsRaw}`
      .toLowerCase()
      .replace(/[^0-9a-zA-Z가-힣\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalizedText) {
      return [];
    }

    const keywords: string[] = [];
    const seen = new Set<string>();

    for (const token of normalizedText.split(' ')) {
      if (token.length < 2 || seen.has(token)) {
        continue;
      }

      seen.add(token);
      keywords.push(token);

      if (keywords.length >= MeetingMinuteKeywordService.MAX_KEYWORDS) {
        break;
      }
    }

    return keywords;
  }
}
