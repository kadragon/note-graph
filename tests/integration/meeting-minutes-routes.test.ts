import { PersonRepository } from '@worker/repositories/person-repository';
import { TaskCategoryRepository } from '@worker/repositories/task-category-repository';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDatabaseFactory } from '../helpers/test-app';

vi.mock('@worker/adapters/database-factory', () => mockDatabaseFactory());

import worker from '@worker/index';
import { createAuthFetch } from '../helpers/test-app';
import { pglite } from '../pg-setup';

const authFetch = createAuthFetch(worker);

describe('Meeting Minutes API Routes', () => {
  beforeEach(async () => {
    await pglite.query('DELETE FROM work_note_meeting_minute');
    await pglite.query('DELETE FROM meeting_minute_task_category');
    await pglite.query('DELETE FROM meeting_minute_group');
    await pglite.query('DELETE FROM meeting_minute_person');
    await pglite.query('DELETE FROM meeting_minutes');
    await pglite.query('DELETE FROM task_categories');
    await pglite.query('DELETE FROM person_dept_history');
    await pglite.query('DELETE FROM persons');
    await pglite.query('DELETE FROM departments');
  });

  describe('POST /api/meeting-minutes', () => {
    it('returns 201 with generated keywords and joined attendee/category payload', async () => {
      const now = new Date().toISOString();
      await pglite.query(
        'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        ['PRS001', 'Alice Kim', now, now]
      );
      await pglite.query(
        'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        ['PRS002', 'Bob Lee', now, now]
      );
      await pglite.query(
        'INSERT INTO task_categories (category_id, name, is_active, created_at) VALUES ($1, $2, $3, $4)',
        ['CAT001', 'Planning', true, now]
      );

      const findPersonByIdSpy = vi.spyOn(PersonRepository.prototype, 'findById');
      const findPersonByIdsSpy = vi.spyOn(PersonRepository.prototype, 'findByIds');
      const findCategoryByIdSpy = vi.spyOn(TaskCategoryRepository.prototype, 'findById');
      const findCategoryByIdsSpy = vi.spyOn(TaskCategoryRepository.prototype, 'findByIds');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  keywords: ['Roadmap', 'Budget'],
                }),
              },
            },
          ],
        }),
      });

      const response = await authFetch('/api/meeting-minutes', {
        method: 'POST',
        body: JSON.stringify({
          meetingDate: '2026-02-11',
          topic: 'Q2 Roadmap Sync',
          detailsRaw: 'Discussed roadmap, budget, and hiring plan.',
          attendeePersonIds: ['PRS001', 'PRS002'],
          categoryIds: ['CAT001'],
        }),
      });

      expect(response.status).toBe(201);

      const created = await response.json<{
        meetingId: string;
        meetingDate: string;
        topic: string;
        detailsRaw: string;
        keywords: string[];
        attendees: Array<{ personId: string; name: string }>;
        categories: Array<{ categoryId: string; name: string }>;
      }>();

      expect(created.meetingId).toMatch(/^MEET-/);
      expect(created.meetingDate).toContain('2026-02-11');
      expect(created.topic).toBe('Q2 Roadmap Sync');
      expect(created.detailsRaw).toBe('Discussed roadmap, budget, and hiring plan.');
      expect(created.keywords).toEqual(['roadmap', 'budget']);
      expect(created.attendees).toEqual([
        { personId: 'PRS001', name: 'Alice Kim' },
        { personId: 'PRS002', name: 'Bob Lee' },
      ]);
      expect(created.categories).toEqual([{ categoryId: 'CAT001', name: 'Planning' }]);
      expect(findPersonByIdsSpy).toHaveBeenCalledTimes(1);
      expect(findPersonByIdsSpy).toHaveBeenCalledWith(['PRS001', 'PRS002']);
      expect(findCategoryByIdsSpy).toHaveBeenCalledTimes(1);
      expect(findCategoryByIdsSpy).toHaveBeenCalledWith(['CAT001']);
      expect(findPersonByIdSpy).not.toHaveBeenCalled();
      expect(findCategoryByIdSpy).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/meeting-minutes', () => {
    it('returns filtered paginated list with stable sort by meetingDate/updatedAt', async () => {
      const now = new Date().toISOString();
      await pglite.query(
        'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        ['PRS001', 'Alice Kim', now, now]
      );
      await pglite.query(
        'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        ['PRS002', 'Bob Lee', now, now]
      );
      await pglite.query(
        'INSERT INTO task_categories (category_id, name, is_active, created_at) VALUES ($1, $2, $3, $4)',
        ['CAT001', 'Planning', true, now]
      );
      await pglite.query(
        'INSERT INTO task_categories (category_id, name, is_active, created_at) VALUES ($1, $2, $3, $4)',
        ['CAT002', 'Ops', true, now]
      );
      await pglite.query(
        `INSERT INTO meeting_minutes (
            meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'MEET-A',
          '2026-02-10',
          'Roadmap Alpha',
          'roadmap details',
          JSON.stringify(['roadmap']),
          'roadmap',
          '2026-02-10T10:00:00.000Z',
          '2026-02-10T12:00:00.000Z',
        ]
      );
      await pglite.query(
        `INSERT INTO meeting_minutes (
            meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'MEET-B',
          '2026-02-10',
          'Roadmap Beta',
          'roadmap details',
          JSON.stringify(['roadmap']),
          'roadmap',
          '2026-02-10T10:30:00.000Z',
          '2026-02-10T11:00:00.000Z',
        ]
      );
      await pglite.query(
        `INSERT INTO meeting_minutes (
            meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'MEET-C',
          '2026-02-09',
          'Ops Review',
          'ops details',
          JSON.stringify(['ops']),
          'ops',
          '2026-02-09T09:00:00.000Z',
          '2026-02-09T10:00:00.000Z',
        ]
      );
      await pglite.query(
        'INSERT INTO meeting_minute_person (meeting_id, person_id) VALUES ($1, $2)',
        ['MEET-A', 'PRS001']
      );
      await pglite.query(
        'INSERT INTO meeting_minute_person (meeting_id, person_id) VALUES ($1, $2)',
        ['MEET-B', 'PRS001']
      );
      await pglite.query(
        'INSERT INTO meeting_minute_person (meeting_id, person_id) VALUES ($1, $2)',
        ['MEET-C', 'PRS002']
      );
      await pglite.query(
        'INSERT INTO meeting_minute_task_category (meeting_id, category_id) VALUES ($1, $2)',
        ['MEET-A', 'CAT001']
      );
      await pglite.query(
        'INSERT INTO meeting_minute_task_category (meeting_id, category_id) VALUES ($1, $2)',
        ['MEET-B', 'CAT001']
      );
      await pglite.query(
        'INSERT INTO meeting_minute_task_category (meeting_id, category_id) VALUES ($1, $2)',
        ['MEET-C', 'CAT002']
      );

      const response = await authFetch(
        '/api/meeting-minutes?q=roadmap&meetingDateFrom=2026-02-10&meetingDateTo=2026-02-10&categoryId=CAT001&attendeePersonId=PRS001&page=1&pageSize=1'
      );

      expect(response.status).toBe(200);
      const data = await response.json<{
        items: Array<{ meetingId: string; meetingDate: string; updatedAt: string }>;
        total: number;
        page: number;
        pageSize: number;
      }>();

      expect(data.total).toBe(2);
      expect(data.page).toBe(1);
      expect(data.pageSize).toBe(1);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].meetingId).toBe('MEET-A');

      const secondResponse = await authFetch(
        '/api/meeting-minutes?q=roadmap&meetingDateFrom=2026-02-10&meetingDateTo=2026-02-10&categoryId=CAT001&attendeePersonId=PRS001&page=2&pageSize=1'
      );
      const secondData = await secondResponse.json<{
        items: Array<{ meetingId: string; meetingDate: string; updatedAt: string }>;
        total: number;
        page: number;
        pageSize: number;
      }>();

      expect(secondResponse.status).toBe(200);
      expect(secondData.total).toBe(2);
      expect(secondData.items).toHaveLength(1);
      expect(secondData.items[0].meetingId).toBe('MEET-B');
    });
  });

  describe('GET /api/meeting-minutes/:meetingId', () => {
    it('returns full detail including attendees, categories, and keywords', async () => {
      await pglite.query(
        'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        ['PRS001', 'Alice Kim', '2026-02-12T09:00:00.000Z', '2026-02-12T09:00:00.000Z']
      );
      await pglite.query(
        'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        ['PRS002', 'Bob Lee', '2026-02-12T09:00:00.000Z', '2026-02-12T09:00:00.000Z']
      );
      await pglite.query(
        'INSERT INTO task_categories (category_id, name, is_active, created_at) VALUES ($1, $2, $3, $4)',
        ['CAT001', 'Planning', true, '2026-02-12T09:00:00.000Z']
      );
      await pglite.query(
        'INSERT INTO task_categories (category_id, name, is_active, created_at) VALUES ($1, $2, $3, $4)',
        ['CAT002', 'Ops', true, '2026-02-12T09:00:00.000Z']
      );
      await pglite.query(
        `INSERT INTO meeting_minutes (
            meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'MEET-DTL',
          '2026-02-12',
          'Detail Review',
          'Detailed discussion for roadmap and operations',
          JSON.stringify(['roadmap', 'operations']),
          'roadmap operations',
          '2026-02-12T10:00:00.000Z',
          '2026-02-12T10:30:00.000Z',
        ]
      );
      await pglite.query(
        'INSERT INTO meeting_minute_person (meeting_id, person_id) VALUES ($1, $2)',
        ['MEET-DTL', 'PRS001']
      );
      await pglite.query(
        'INSERT INTO meeting_minute_person (meeting_id, person_id) VALUES ($1, $2)',
        ['MEET-DTL', 'PRS002']
      );
      await pglite.query(
        'INSERT INTO meeting_minute_task_category (meeting_id, category_id) VALUES ($1, $2)',
        ['MEET-DTL', 'CAT001']
      );
      await pglite.query(
        'INSERT INTO meeting_minute_task_category (meeting_id, category_id) VALUES ($1, $2)',
        ['MEET-DTL', 'CAT002']
      );

      const response = await authFetch('/api/meeting-minutes/MEET-DTL');
      expect(response.status).toBe(200);

      const detail = await response.json<{
        meetingId: string;
        meetingDate: string;
        topic: string;
        detailsRaw: string;
        keywords: string[];
        attendees: Array<{ personId: string; name: string }>;
        categories: Array<{ categoryId: string; name: string }>;
      }>();

      expect(detail.meetingId).toBe('MEET-DTL');
      expect(detail.meetingDate).toContain('2026-02-12');
      expect(detail.topic).toBe('Detail Review');
      expect(detail.detailsRaw).toBe('Detailed discussion for roadmap and operations');
      expect(detail.keywords).toEqual(['roadmap', 'operations']);
      expect(detail.attendees).toEqual([
        { personId: 'PRS001', name: 'Alice Kim' },
        { personId: 'PRS002', name: 'Bob Lee' },
      ]);
      expect(detail.categories).toEqual([
        { categoryId: 'CAT001', name: 'Planning' },
        { categoryId: 'CAT002', name: 'Ops' },
      ]);
    });

    it('returns linked work note count for traceability', async () => {
      const now = '2026-02-12T09:00:00.000Z';
      await pglite.query(
        `INSERT INTO meeting_minutes (
            meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'MEET-TRACE',
          '2026-02-12',
          'Traceability Review',
          'Discussed link coverage with work notes',
          JSON.stringify(['traceability']),
          'traceability',
          now,
          now,
        ]
      );
      await pglite.query(
        'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        ['WORK-TRACE-1', 'Trace Work 1', 'Details 1', now, now]
      );
      await pglite.query(
        'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        ['WORK-TRACE-2', 'Trace Work 2', 'Details 2', now, now]
      );
      await pglite.query(
        'INSERT INTO work_note_meeting_minute (work_id, meeting_id) VALUES ($1, $2)',
        ['WORK-TRACE-1', 'MEET-TRACE']
      );
      await pglite.query(
        'INSERT INTO work_note_meeting_minute (work_id, meeting_id) VALUES ($1, $2)',
        ['WORK-TRACE-2', 'MEET-TRACE']
      );

      const response = await authFetch('/api/meeting-minutes/MEET-TRACE');
      expect(response.status).toBe(200);

      const detail = await response.json<{ linkedWorkNoteCount: number }>();
      expect(detail.linkedWorkNoteCount).toBe(2);
    });
  });

  describe('PUT /api/meeting-minutes/:meetingId', () => {
    it('updates fields and re-generates keywords', async () => {
      const now = '2026-02-13T09:00:00.000Z';
      await pglite.query(
        'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        ['PRS001', 'Alice Kim', now, now]
      );
      await pglite.query(
        'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        ['PRS002', 'Bob Lee', now, now]
      );
      await pglite.query(
        'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        ['PRS003', 'Chris Park', now, now]
      );
      await pglite.query(
        'INSERT INTO task_categories (category_id, name, is_active, created_at) VALUES ($1, $2, $3, $4)',
        ['CAT001', 'Planning', true, now]
      );
      await pglite.query(
        'INSERT INTO task_categories (category_id, name, is_active, created_at) VALUES ($1, $2, $3, $4)',
        ['CAT002', 'Execution', true, now]
      );
      await pglite.query(
        `INSERT INTO meeting_minutes (
            meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'MEET-UPD',
          '2026-02-12',
          'Initial Topic',
          'Initial details',
          JSON.stringify(['initial']),
          'initial',
          now,
          now,
        ]
      );
      await pglite.query(
        'INSERT INTO meeting_minute_person (meeting_id, person_id) VALUES ($1, $2)',
        ['MEET-UPD', 'PRS001']
      );
      await pglite.query(
        'INSERT INTO meeting_minute_task_category (meeting_id, category_id) VALUES ($1, $2)',
        ['MEET-UPD', 'CAT001']
      );

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  keywords: ['Execution', 'Q2 Focus'],
                }),
              },
            },
          ],
        }),
      });

      const response = await authFetch('/api/meeting-minutes/MEET-UPD', {
        method: 'PUT',
        body: JSON.stringify({
          meetingDate: '2026-02-13',
          topic: 'Updated Topic',
          detailsRaw: 'Updated details focused on execution milestones',
          attendeePersonIds: ['PRS002', 'PRS003'],
          categoryIds: ['CAT002'],
        }),
      });

      expect(response.status).toBe(200);

      const updated = await response.json<{
        meetingId: string;
        meetingDate: string;
        topic: string;
        detailsRaw: string;
        keywords: string[];
        attendees: Array<{ personId: string; name: string }>;
        categories: Array<{ categoryId: string; name: string }>;
      }>();

      expect(updated.meetingId).toBe('MEET-UPD');
      expect(updated.meetingDate).toContain('2026-02-13');
      expect(updated.topic).toBe('Updated Topic');
      expect(updated.detailsRaw).toBe('Updated details focused on execution milestones');
      expect(updated.keywords).toEqual(['execution', 'q2 focus']);
      expect(updated.attendees).toEqual([
        { personId: 'PRS002', name: 'Bob Lee' },
        { personId: 'PRS003', name: 'Chris Park' },
      ]);
      expect(updated.categories).toEqual([{ categoryId: 'CAT002', name: 'Execution' }]);
    });
  });

  describe('Duplicate Guard', () => {
    it('rejects create and update when same date has a highly similar topic', async () => {
      const now = '2026-02-16T09:00:00.000Z';
      await pglite.query(
        'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        ['PRS001', 'Alice Kim', now, now]
      );
      await pglite.query(
        `INSERT INTO meeting_minutes (
            meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'MEET-BASE',
          '2026-02-16',
          'Q2 Roadmap Sync',
          'Roadmap planning details',
          JSON.stringify(['roadmap']),
          'roadmap',
          now,
          now,
        ]
      );
      await pglite.query(
        `INSERT INTO meeting_minutes (
            meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'MEET-OTHER',
          '2026-02-16',
          'Budget Review',
          'Budget review details',
          JSON.stringify(['budget']),
          'budget',
          now,
          now,
        ]
      );

      const createResponse = await authFetch('/api/meeting-minutes', {
        method: 'POST',
        body: JSON.stringify({
          meetingDate: '2026-02-16',
          topic: 'Q2 Roadmap Sync Meeting',
          detailsRaw: 'Another discussion with almost same topic',
          attendeePersonIds: ['PRS001'],
        }),
      });

      expect(createResponse.status).toBe(409);
      const createError = await createResponse.json<{ code: string; message: string }>();
      expect(createError.code).toBe('CONFLICT');

      const updateResponse = await authFetch('/api/meeting-minutes/MEET-OTHER', {
        method: 'PUT',
        body: JSON.stringify({
          meetingDate: '2026-02-16',
          topic: 'Q2 roadmap sync',
        }),
      });

      expect(updateResponse.status).toBe(409);
      const updateError = await updateResponse.json<{ code: string; message: string }>();
      expect(updateError.code).toBe('CONFLICT');
    });
  });

  describe('DELETE /api/meeting-minutes/:meetingId', () => {
    it('returns 204 and removes the record', async () => {
      await pglite.query(
        `INSERT INTO meeting_minutes (
          meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'MEET-DEL',
          '2026-02-14',
          'Delete Target',
          'Delete details',
          JSON.stringify(['delete']),
          'delete',
          '2026-02-14T09:00:00.000Z',
          '2026-02-14T09:00:00.000Z',
        ]
      );

      const response = await authFetch('/api/meeting-minutes/MEET-DEL', {
        method: 'DELETE',
      });
      expect(response.status).toBe(204);

      const result = await pglite.query(
        'SELECT meeting_id FROM meeting_minutes WHERE meeting_id = $1',
        ['MEET-DEL']
      );

      expect(result.rows).toHaveLength(0);
    });
  });

  describe('POST /api/meeting-minutes/suggest', () => {
    it('returns scored relevant meeting references from FTS', async () => {
      await pglite.query(
        `INSERT INTO meeting_minutes (
            meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'MEET-S1',
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
          'MEET-S2',
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
          'MEET-S3',
          '2026-02-13',
          'Ops Incident Review',
          'Postmortem and operational safeguards',
          JSON.stringify(['ops']),
          'ops',
          '2026-02-13T09:00:00.000Z',
          '2026-02-13T09:00:00.000Z',
        ]
      );

      const response = await authFetch('/api/meeting-minutes/suggest', {
        method: 'POST',
        body: JSON.stringify({
          query: 'roadmap budget',
          limit: 2,
        }),
      });

      expect(response.status).toBe(200);

      const result = await response.json<{
        meetingReferences: Array<{
          meetingId: string;
          meetingDate: string;
          topic: string;
          keywords: string[];
          score: number;
        }>;
      }>();

      expect(result.meetingReferences).toHaveLength(2);
      expect(result.meetingReferences[0]?.meetingId).toBe('MEET-S1');
      expect(result.meetingReferences[1]?.meetingId).toBe('MEET-S2');
      expect(result.meetingReferences[0]?.score).toBeGreaterThan(
        result.meetingReferences[1]?.score ?? 0
      );

      const byId = new Map(result.meetingReferences.map((item) => [item.meetingId, item]));
      expect(byId.get('MEET-S1')?.keywords).toEqual(['roadmap', 'budget']);
      expect(byId.get('MEET-S2')?.keywords).toEqual(['roadmap', 'hiring']);
    });

    it('sanitizes punctuation-heavy query text and avoids MATCH syntax errors', async () => {
      const response = await authFetch('/api/meeting-minutes/suggest', {
        method: 'POST',
        body: JSON.stringify({
          query: '!!! ((( ))) :::',
          limit: 5,
        }),
      });

      expect(response.status).toBe(200);

      const result = await response.json<{
        meetingReferences: Array<{ meetingId: string }>;
      }>();

      expect(result.meetingReferences).toEqual([]);
    });
  });
});
