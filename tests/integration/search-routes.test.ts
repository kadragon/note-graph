import { beforeEach, describe, expect, it } from 'vitest';

import { authFetch, testEnv } from '../test-setup';

describe('Search API Routes', () => {
  beforeEach(async () => {
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM work_note_meeting_minute'),
      testEnv.DB.prepare('DELETE FROM meeting_minute_task_category'),
      testEnv.DB.prepare('DELETE FROM meeting_minute_person'),
      testEnv.DB.prepare('DELETE FROM meeting_minutes'),
      testEnv.DB.prepare('DELETE FROM work_note_relation'),
      testEnv.DB.prepare('DELETE FROM work_note_person'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
      testEnv.DB.prepare('DELETE FROM person_dept_history'),
      testEnv.DB.prepare('DELETE FROM persons'),
      testEnv.DB.prepare('DELETE FROM departments'),
    ]);
  });

  describe('POST /api/search/unified', () => {
    it('includes meeting minute result group with source-specific payload shape', async () => {
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        `INSERT INTO meeting_minutes (
          meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          'MEET-SEARCH-001',
          '2026-02-11',
          'API latency review',
          'Investigated latency spikes and mitigation plan',
          JSON.stringify(['latency', 'api']),
          'latency api',
          now,
          now
        )
        .run();

      const response = await authFetch('/api/search/unified', {
        method: 'POST',
        body: JSON.stringify({
          query: 'latency',
          limit: 10,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json<{
        query: string;
        workNotes: unknown[];
        persons: unknown[];
        departments: unknown[];
        meetingMinutes?: Array<{
          meetingId: string;
          meetingDate: string;
          topic: string;
          keywords: string[];
          score: number;
          source: string;
        }>;
      }>();

      expect(data.query).toBe('latency');
      expect(data.meetingMinutes).toHaveLength(1);
      expect(data.meetingMinutes?.[0]).toMatchObject({
        meetingId: 'MEET-SEARCH-001',
        meetingDate: '2026-02-11',
        topic: 'API latency review',
        keywords: ['latency', 'api'],
        source: 'MEETING_FTS',
      });
      expect(data.meetingMinutes?.[0]?.score).toBeGreaterThan(0);
    });
  });
});
