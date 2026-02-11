import {
  buildMeetingMinutesFtsQuery,
  mapMeetingMinutesFtsScores,
} from '@worker/utils/meeting-minutes-fts';
import { describe, expect, it } from 'vitest';

describe('meeting-minutes-fts utils', () => {
  describe('buildMeetingMinutesFtsQuery()', () => {
    it('extracts alphanumeric terms and removes punctuation-only fragments', () => {
      const query = buildMeetingMinutesFtsQuery('  "roadmap!!"  (budget)   Q2@@  ');

      expect(query).toBe('"roadmap" OR "budget" OR "Q2"');
    });

    it('returns empty query for punctuation-only input', () => {
      const query = buildMeetingMinutesFtsQuery(' !!! ((( ))) ::: ');

      expect(query).toBe('');
    });
  });

  describe('mapMeetingMinutesFtsScores()', () => {
    it('sorts by ascending rank and assigns higher score to better ranks', () => {
      const rows = [
        { meetingId: 'MEET-2', ftsRank: -0.4 },
        { meetingId: 'MEET-1', ftsRank: -0.7 },
        { meetingId: 'MEET-3', ftsRank: -0.1 },
      ];

      const scored = mapMeetingMinutesFtsScores(rows);

      expect(scored.map((row) => row.meetingId)).toEqual(['MEET-1', 'MEET-2', 'MEET-3']);
      expect(scored[0]?.score).toBeGreaterThan(scored[1]?.score ?? 0);
      expect(scored[1]?.score).toBeGreaterThan(scored[2]?.score ?? 0);
    });
  });
});
