import type { Env } from '../types/env';
import { RateLimitError } from '../types/errors';
import { getAIGatewayHeaders, getAIGatewayUrl, isReasoningModel } from '../utils/ai-gateway';
import { DEFAULT_MEETING_MINUTE_KEYWORDS_PROMPT } from './setting-defaults';
import type { SettingService } from './setting-service';

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

  constructor(
    private env: Env,
    private settingService?: SettingService
  ) {}

  private getModel(): string {
    return (
      this.settingService?.getConfigOrEnv(
        'config.openai_model_lightweight',
        this.env.OPENAI_MODEL_LIGHTWEIGHT
      ) ?? this.env.OPENAI_MODEL_LIGHTWEIGHT
    );
  }

  async extractKeywords(input: ExtractKeywordsInput): Promise<string[]> {
    const fallbackKeywords = this.extractDeterministicKeywords(input);

    try {
      const prompt = this.constructPrompt(input);
      const response = await this.callGPT(prompt);
      const parsed = JSON.parse(response) as KeywordResponse;
      const normalized = this.normalizeKeywords(parsed.keywords);
      return normalized.length > 0 ? normalized : fallbackKeywords;
    } catch (error) {
      console.error('[MeetingMinuteKeywordService] Keyword extraction failed:', error);
      return fallbackKeywords;
    }
  }

  private constructPrompt(input: ExtractKeywordsInput): string {
    const template =
      this.settingService?.getValue(
        'prompt.meeting_minute.keywords',
        DEFAULT_MEETING_MINUTE_KEYWORDS_PROMPT
      ) ?? DEFAULT_MEETING_MINUTE_KEYWORDS_PROMPT;
    return template.replace('{{TOPIC}}', input.topic).replace('{{DETAILS_RAW}}', input.detailsRaw);
  }

  private async callGPT(prompt: string): Promise<string> {
    const url = getAIGatewayUrl(this.env, 'chat/completions');
    const model = this.getModel();

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

  private static readonly KOREAN_STOPWORDS = new Set([
    // 대명사
    '이것',
    '그것',
    '저것',
    '이것은',
    '그것은',
    '저것은',
    '여기',
    '거기',
    '저기',
    '이것이',
    '그것이',
    '저것이',
    '이것을',
    '그것을',
    '저것을',
    // 조사 + 대명사 결합형
    '이런',
    '그런',
    '저런',
    '어떤',
    '무슨',
    '어느',
    // 부사
    '매우',
    '아주',
    '너무',
    '정말',
    '진짜',
    '상당히',
    '꽤',
    '약간',
    '조금',
    '이미',
    '벌써',
    '아직',
    '바로',
    '다시',
    '또',
    '더',
    '덜',
    '잘',
    '못',
    // 접속사/접속 부사
    '그리고',
    '그러나',
    '하지만',
    '그래서',
    '따라서',
    '그런데',
    '그러므로',
    '또한',
    '즉',
    '및',
    '혹은',
    '또는',
    // 동사/형용사 어간 (단독 출현 시)
    '있다',
    '없다',
    '하다',
    '되다',
    '이다',
    '아니다',
    '같다',
    '있는',
    '없는',
    '하는',
    '되는',
    '같은',
    '있을',
    '없을',
    '해야',
    '된다',
    '한다',
    // 의존 명사 / 불완전 명사
    '것',
    '수',
    '등',
    '때',
    '중',
    '위',
    '대',
    '내',
    // 관형사
    '모든',
    '각',
    '여러',
    '다른',
    // 구조 표지
    'part',
    'part1',
    'part2',
    'part3',
    'part4',
    'step',
    'section',
  ]);

  private extractDeterministicKeywords(input: ExtractKeywordsInput): string[] {
    const normalizedText = `${input.topic} ${input.detailsRaw}`
      .toLowerCase()
      .replace(/[^0-9a-zA-Z가-힣\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalizedText) {
      return [];
    }

    const tokens = normalizedText
      .split(' ')
      .filter(
        (token) =>
          token.length >= 2 &&
          !MeetingMinuteKeywordService.KOREAN_STOPWORDS.has(token) &&
          !/^\d+$/.test(token)
      );

    // 빈도 기반 정렬
    const freq = new Map<string, number>();
    for (const token of tokens) {
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }

    const uniqueTokens = [...new Set(tokens)];
    uniqueTokens.sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0));

    return uniqueTokens.slice(0, MeetingMinuteKeywordService.MAX_KEYWORDS);
  }
}
