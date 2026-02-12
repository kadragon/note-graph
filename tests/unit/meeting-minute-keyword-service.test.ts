import { env } from 'cloudflare:test';
import { MeetingMinuteKeywordService } from '@worker/services/meeting-minute-keyword-service';
import type { Env } from '@worker/types/env';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const testEnv = env as unknown as Env;

describe('MeetingMinuteKeywordService', () => {
  let service: MeetingMinuteKeywordService;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    service = new MeetingMinuteKeywordService(testEnv);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

      const expected = ['q2', 'budget', 'sync', 'roadmap', 'hiring', 'plan', 'blockers'];

      await expect(service.extractKeywords(input)).resolves.toEqual(expected);
      await expect(service.extractKeywords(input)).resolves.toEqual(expected);
    });
  });
});
