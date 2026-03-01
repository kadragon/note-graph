import { KeywordSearchService } from '@worker/services/keyword-search-service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authFetch, testEnv } from '../test-setup';

describe('Search API Routes', () => {
  beforeEach(async () => {
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM work_note_meeting_minute'),
      testEnv.DB.prepare('DELETE FROM meeting_minute_task_category'),
      testEnv.DB.prepare('DELETE FROM meeting_minute_group'),
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
    it('uses lexical work-note search path without embedding fetch calls', async () => {
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        `INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind('WORK-SEARCH-001', '검색 성능 개선', '벡터 호출 없이 키워드 검색', '운영', now, now)
        .run();

      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const response = await authFetch('/api/search/unified', {
        method: 'POST',
        body: JSON.stringify({
          query: '검색 성능',
          limit: 10,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json<{
        workNotes: Array<{ source: string; workNote: { workId: string } }>;
      }>();

      expect(data.workNotes.length).toBeGreaterThan(0);
      expect(data.workNotes[0]?.workNote.workId).toBe('WORK-SEARCH-001');
      expect(data.workNotes[0]?.source).toBe('LEXICAL');
      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    it('includes meeting minute result group with source-specific payload shape', async () => {
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO meeting_minutes (
            meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'MEET-SEARCH-001',
          '2026-02-11',
          'API latency review',
          'Investigated latency spikes and mitigation plan',
          JSON.stringify(['latency', 'api']),
          'latency api',
          now,
          now
        ),
        testEnv.DB.prepare(
          `INSERT INTO meeting_minutes (
            meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'MEET-SEARCH-002',
          '2026-02-10',
          'Latency and caching follow-up',
          'Focused mostly on cache warmup strategy',
          JSON.stringify(['latency', 'cache']),
          'latency cache',
          now,
          now
        ),
      ]);

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
      expect(data.meetingMinutes).toHaveLength(2);
      expect(data.meetingMinutes?.[0]).toMatchObject({
        meetingId: 'MEET-SEARCH-001',
        meetingDate: '2026-02-11',
        topic: 'API latency review',
        keywords: ['latency', 'api'],
        source: 'MEETING_FTS',
      });
      expect(data.meetingMinutes?.[0]?.score).toBeGreaterThan(data.meetingMinutes?.[1]?.score ?? 0);
    });

    it('sanitizes punctuation-heavy query for meeting minute references', async () => {
      vi.spyOn(KeywordSearchService.prototype, 'search').mockResolvedValue([]);

      const response = await authFetch('/api/search/unified', {
        method: 'POST',
        body: JSON.stringify({
          query: '!!! ((( ))) :::',
          limit: 10,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json<{
        meetingMinutes?: Array<{ meetingId: string }>;
      }>();

      expect(data.meetingMinutes).toEqual([]);
    });
  });

  describe('POST /api/search/work-notes', () => {
    it('returns lexical searchType and lexical source', async () => {
      const keywordSearchSpy = vi
        .spyOn(KeywordSearchService.prototype, 'search')
        .mockResolvedValue([
          {
            workNote: {
              workId: 'WORK-SEARCH-TYPE-001',
              title: '검색 타입 테스트',
              contentRaw: '키워드 검색 응답',
              category: '운영',
              createdAt: '2026-02-21T00:00:00.000Z',
              updatedAt: '2026-02-21T00:00:00.000Z',
              embeddedAt: null,
            },
            score: 0.94,
            source: 'LEXICAL',
          },
        ]);

      const response = await authFetch('/api/search/work-notes', {
        method: 'POST',
        body: JSON.stringify({
          query: '검색',
          limit: 10,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json<{
        searchType: string;
        results: Array<{ source: string; workNote: { workId: string } }>;
      }>();

      expect(data.searchType).toBe('LEXICAL');
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.results[0]?.source).toBe('LEXICAL');
      expect(data.results[0]?.workNote.workId).toBe('WORK-SEARCH-TYPE-001');

      keywordSearchSpy.mockRestore();
    });
  });
});
