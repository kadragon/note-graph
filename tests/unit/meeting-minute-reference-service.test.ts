import { env } from 'cloudflare:test';
import { MeetingMinuteReferenceService } from '@worker/services/meeting-minute-reference-service';
import type { Env } from '@worker/types/env';
import { beforeEach, describe, expect, it } from 'vitest';

const testEnv = env as unknown as Env;

describe('MeetingMinuteReferenceService', () => {
  let service: MeetingMinuteReferenceService;

  beforeEach(async () => {
    service = new MeetingMinuteReferenceService(testEnv.DB);

    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM work_note_meeting_minute'),
      testEnv.DB.prepare('DELETE FROM meeting_minute_task_category'),
      testEnv.DB.prepare('DELETE FROM meeting_minute_person'),
      testEnv.DB.prepare('DELETE FROM meeting_minutes'),
    ]);
  });

  it('returns scored references ordered by relevance', async () => {
    await testEnv.DB.batch([
      testEnv.DB.prepare(
        `INSERT INTO meeting_minutes (
          meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        'MEET-REF-1',
        '2026-02-15',
        'Q2 Roadmap Budget Sync',
        'Roadmap budget prioritization and timeline discussion',
        JSON.stringify(['roadmap', 'budget']),
        'roadmap budget',
        '2026-02-15T09:00:00.000Z',
        '2026-02-15T09:00:00.000Z'
      ),
      testEnv.DB.prepare(
        `INSERT INTO meeting_minutes (
          meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        'MEET-REF-2',
        '2026-02-14',
        'Roadmap Hiring Plan',
        'Discussed roadmap and hiring plan dependencies',
        JSON.stringify(['roadmap', 'hiring']),
        'roadmap hiring',
        '2026-02-14T09:00:00.000Z',
        '2026-02-14T09:00:00.000Z'
      ),
      testEnv.DB.prepare(
        `INSERT INTO meeting_minutes (
          meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        'MEET-REF-3',
        '2026-02-13',
        'Operations Review',
        'Postmortem and operational safeguards',
        JSON.stringify(['ops']),
        'ops',
        '2026-02-13T09:00:00.000Z',
        '2026-02-13T09:00:00.000Z'
      ),
    ]);

    const references = await service.search('roadmap budget', 2);

    expect(references).toHaveLength(2);
    expect(references[0]?.meetingId).toBe('MEET-REF-1');
    expect(references[1]?.meetingId).toBe('MEET-REF-2');
    expect(references[0]?.score).toBeGreaterThan(references[1]?.score ?? 0);

    const byId = new Map(references.map((reference) => [reference.meetingId, reference]));
    expect(byId.get('MEET-REF-1')?.keywords).toEqual(['roadmap', 'budget']);
    expect(byId.get('MEET-REF-2')?.keywords).toEqual(['roadmap', 'hiring']);
  });

  it('returns empty list for punctuation-only queries', async () => {
    const references = await service.search(' !!! ((( ))) ::: ', 5);

    expect(references).toEqual([]);
  });
});
