import { MeetingMinuteKeywordService } from '@worker/services/meeting-minute-keyword-service';
import { DEFAULT_MEETING_MINUTE_KEYWORDS_PROMPT } from '@worker/services/setting-defaults';
import type { Env } from '@worker/types/env';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('MeetingMinuteKeywordService', () => {
  let service: MeetingMinuteKeywordService;
  let mockFetch: ReturnType<typeof vi.fn>;

  const mockEnv = {
    OPENAI_API_KEY: 'test-key',
    OPENAI_MODEL_LIGHTWEIGHT: 'gpt-4o-mini',
    CLOUDFLARE_ACCOUNT_ID: 'test-account',
    AI_GATEWAY_ID: 'test-gateway',
  } as unknown as Env;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    service = new MeetingMinuteKeywordService(mockEnv);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('prompt quality', () => {
    it('includes instruction to extract compound nouns and exclude particles', () => {
      expect(DEFAULT_MEETING_MINUTE_KEYWORDS_PROMPT).toMatch(/복합\s*명사|복합어/);
      expect(DEFAULT_MEETING_MINUTE_KEYWORDS_PROMPT).toMatch(/조사|어미/);
    });

    it('specifies max keyword count in prompt', () => {
      expect(DEFAULT_MEETING_MINUTE_KEYWORDS_PROMPT).toMatch(/10/);
    });
  });

  describe('extractKeywords()', () => {
    it('normalizes and deduplicates AI output with max keyword count', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  keywords: [
                    ' Budget ',
                    'budget',
                    '#Roadmap',
                    'Roadmap',
                    'Q2',
                    ' q2 ',
                    'Hiring Plan',
                    'hiring   plan',
                    '',
                    '   ',
                    'Alpha',
                    'Beta',
                    'Gamma',
                    'Delta',
                    'Epsilon',
                    'Zeta',
                    'Eta',
                    'Theta',
                    'Iota',
                    'Kappa',
                  ],
                }),
              },
            },
          ],
        }),
      });

      const keywords = await service.extractKeywords({
        topic: 'Q2 Budget and Hiring',
        detailsRaw: 'Roadmap and budget planning with hiring plan updates.',
      });

      expect(keywords).toEqual([
        'budget',
        'roadmap',
        'q2',
        'hiring plan',
        'alpha',
        'beta',
        'gamma',
        'delta',
        'epsilon',
        'zeta',
      ]);
    });

    it('falls back to deterministic keywords when AI response is invalid or fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'not-json' } }],
          }),
        })
        .mockRejectedValueOnce(new Error('network down'));

      const input = {
        topic: 'Q2 Budget Sync',
        detailsRaw: 'Roadmap hiring plan blockers budget',
      };

      // budget appears twice in input so ranks first by frequency
      const expected = ['budget', 'q2', 'sync', 'roadmap', 'hiring', 'plan', 'blockers'];

      await expect(service.extractKeywords(input)).resolves.toEqual(expected);
      await expect(service.extractKeywords(input)).resolves.toEqual(expected);
    });

    it('deterministic fallback filters Korean stopwords', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fail'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const keywords = await service.extractKeywords({
        topic: '보고서 작성하는 방법',
        detailsRaw: '이것은 매우 중요한 업무보고 문서이다',
      });

      // 불용어(이것은, 매우) 제외, 형태소 미분리로 '문서이다'는 포함
      expect(keywords).toEqual(['보고서', '작성하는', '방법', '중요한', '업무보고', '문서이다']);
    });

    it('deterministic fallback filters pure numbers and single-char English tokens', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fail'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const keywords = await service.extractKeywords({
        topic: 'Part 1 A B 기획력 보고서',
        detailsRaw: '2024 12 triangle 접근방법',
      });

      expect(keywords).toEqual(['기획력', '보고서', 'triangle', '접근방법']);
    });

    it('logs error with context when GPT call fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValueOnce(new Error('network timeout'));

      await service.extractKeywords({
        topic: '예산 회의',
        detailsRaw: '2분기 예산 논의',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Keyword extraction failed'),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it('logs error when GPT returns unparseable JSON', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'not-json' } }],
        }),
      });

      await service.extractKeywords({
        topic: '예산 회의',
        detailsRaw: '2분기 예산 논의',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Keyword extraction failed'),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });
});
