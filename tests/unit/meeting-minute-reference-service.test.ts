import { MeetingMinuteReferenceService } from '@worker/services/meeting-minute-reference-service';
import { beforeEach, describe, expect, it } from 'vitest';
import { pglite, testPgDb } from '../pg-setup';

describe('MeetingMinuteReferenceService', () => {
  let service: MeetingMinuteReferenceService;

  beforeEach(async () => {
    service = new MeetingMinuteReferenceService(testPgDb);

    await pglite.query(
      'TRUNCATE work_note_meeting_minute, meeting_minute_task_category, meeting_minute_group, meeting_minute_person, meeting_minutes CASCADE'
    );
  });

  it('returns scored references ordered by relevance', async () => {
    await pglite.query(
      `INSERT INTO meeting_minutes (
          meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'MEET-REF-1',
        '2026-02-15',
        'Q2 Roadmap Budget Sync',
        'Roadmap budget prioritization and timeline discussion',
        JSON.stringify(['roadmap', 'budget']),
        'roadmap budget',
        '2026-02-15T09:00:00.000Z',
        '2026-02-15T09:00:00.000Z',
      ]
    );
    await pglite.query(
      `INSERT INTO meeting_minutes (
          meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'MEET-REF-2',
        '2026-02-14',
        'Roadmap Hiring Plan',
        'Discussed roadmap and hiring plan dependencies',
        JSON.stringify(['roadmap', 'hiring']),
        'roadmap hiring',
        '2026-02-14T09:00:00.000Z',
        '2026-02-14T09:00:00.000Z',
      ]
    );
    await pglite.query(
      `INSERT INTO meeting_minutes (
          meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'MEET-REF-3',
        '2026-02-13',
        'Operations Review',
        'Postmortem and operational safeguards',
        JSON.stringify(['ops']),
        'ops',
        '2026-02-13T09:00:00.000Z',
        '2026-02-13T09:00:00.000Z',
      ]
    );

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

  it('filters out results below minScore threshold', async () => {
    await pglite.query(
      `INSERT INTO meeting_minutes (
          meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'MEET-SCORE-1',
        '2026-03-01',
        'Budget Planning Session',
        'Detailed budget planning and allocation discussion',
        JSON.stringify(['budget', 'planning']),
        'budget planning',
        '2026-03-01T09:00:00.000Z',
        '2026-03-01T09:00:00.000Z',
      ]
    );
    await pglite.query(
      `INSERT INTO meeting_minutes (
          meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'MEET-SCORE-2',
        '2026-03-02',
        'Team Standup',
        'Quick standup with brief budget mention',
        JSON.stringify(['standup']),
        'standup',
        '2026-03-02T09:00:00.000Z',
        '2026-03-02T09:00:00.000Z',
      ]
    );

    // With high minScore, only the top-scored result passes (normalized score=1.0)
    const strict = await service.search('budget planning', 10, 0.9);
    // With default minScore (0), all FTS matches are returned
    const relaxed = await service.search('budget planning', 10);

    expect(relaxed).toHaveLength(2);
    expect(strict).toHaveLength(1);
    expect(strict[0].meetingId).toBe('MEET-SCORE-1');
  });
});
