import { env } from 'cloudflare:test';
import { MeetingMinuteRepository } from '@worker/repositories/meeting-minute-repository';
import type { CreateMeetingMinuteInput } from '@worker/schemas/meeting-minute';
import type { Env } from '@worker/types/env';
import { beforeEach, describe, expect, it } from 'vitest';

const testEnv = env as unknown as Env;

describe('MeetingMinuteRepository', () => {
  let repository: MeetingMinuteRepository;

  beforeEach(async () => {
    repository = new MeetingMinuteRepository(testEnv.DB);

    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM work_note_meeting_minute'),
      testEnv.DB.prepare('DELETE FROM meeting_minute_task_category'),
      testEnv.DB.prepare('DELETE FROM meeting_minute_person'),
      testEnv.DB.prepare('DELETE FROM meeting_minutes'),
      testEnv.DB.prepare('DELETE FROM task_categories'),
      testEnv.DB.prepare('DELETE FROM persons'),
    ]);
  });

  describe('create()', () => {
    it('persists base fields plus attendee/category associations', async () => {
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(
          '123456',
          '홍길동'
        ),
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(
          '654321',
          '김철수'
        ),
        testEnv.DB.prepare('INSERT INTO task_categories (category_id, name) VALUES (?, ?)').bind(
          'CAT-001',
          '회의'
        ),
        testEnv.DB.prepare('INSERT INTO task_categories (category_id, name) VALUES (?, ?)').bind(
          'CAT-002',
          '계획'
        ),
      ]);

      const input: CreateMeetingMinuteInput = {
        meetingDate: '2026-02-11',
        topic: '주간 진행 회의',
        detailsRaw: '다음 주 일정과 담당자 확정',
        attendeePersonIds: ['123456', '654321'],
        categoryIds: ['CAT-001', 'CAT-002'],
      };

      const created = await repository.create(input);

      const meetingRow = await testEnv.DB.prepare(
        `SELECT meeting_id as meetingId, meeting_date as meetingDate, topic, details_raw as detailsRaw
           FROM meeting_minutes
           WHERE meeting_id = ?`
      )
        .bind(created.meetingId)
        .first<{
          meetingId: string;
          meetingDate: string;
          topic: string;
          detailsRaw: string;
        }>();

      expect(meetingRow).not.toBeNull();
      expect(meetingRow?.meetingDate).toBe(input.meetingDate);
      expect(meetingRow?.topic).toBe(input.topic);
      expect(meetingRow?.detailsRaw).toBe(input.detailsRaw);

      const attendeeRows = await testEnv.DB.prepare(
        `SELECT person_id as personId
           FROM meeting_minute_person
           WHERE meeting_id = ?
           ORDER BY person_id ASC`
      )
        .bind(created.meetingId)
        .all<{ personId: string }>();

      expect((attendeeRows.results || []).map((row) => row.personId)).toEqual(['123456', '654321']);

      const categoryRows = await testEnv.DB.prepare(
        `SELECT category_id as categoryId
           FROM meeting_minute_task_category
           WHERE meeting_id = ?
           ORDER BY category_id ASC`
      )
        .bind(created.meetingId)
        .all<{ categoryId: string }>();

      expect((categoryRows.results || []).map((row) => row.categoryId)).toEqual([
        'CAT-001',
        'CAT-002',
      ]);
    });
  });

  describe('update()', () => {
    it('replaces attendee/category associations idempotently', async () => {
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(
          '111111',
          '참석자1'
        ),
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(
          '222222',
          '참석자2'
        ),
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(
          '333333',
          '참석자3'
        ),
        testEnv.DB.prepare('INSERT INTO task_categories (category_id, name) VALUES (?, ?)').bind(
          'CAT-OLD',
          '기존'
        ),
        testEnv.DB.prepare('INSERT INTO task_categories (category_id, name) VALUES (?, ?)').bind(
          'CAT-NEW',
          '신규'
        ),
      ]);

      const created = await repository.create({
        meetingDate: '2026-02-11',
        topic: '초기 회의',
        detailsRaw: '초기 내용',
        attendeePersonIds: ['111111', '222222'],
        categoryIds: ['CAT-OLD'],
      });

      const updatePayload = {
        attendeePersonIds: ['222222', '333333'],
        categoryIds: ['CAT-NEW'],
      };

      await repository.update(created.meetingId, updatePayload);
      await repository.update(created.meetingId, updatePayload);

      const attendeeRows = await testEnv.DB.prepare(
        `SELECT person_id as personId
           FROM meeting_minute_person
           WHERE meeting_id = ?
           ORDER BY person_id ASC`
      )
        .bind(created.meetingId)
        .all<{ personId: string }>();

      expect((attendeeRows.results || []).map((row) => row.personId)).toEqual(['222222', '333333']);

      const categoryRows = await testEnv.DB.prepare(
        `SELECT category_id as categoryId
           FROM meeting_minute_task_category
           WHERE meeting_id = ?
           ORDER BY category_id ASC`
      )
        .bind(created.meetingId)
        .all<{ categoryId: string }>();

      expect((categoryRows.results || []).map((row) => row.categoryId)).toEqual(['CAT-NEW']);
    });
  });

  describe('findAll()', () => {
    it('supports q, date range, category, and attendee filters', async () => {
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(
          '111111',
          '참석자1'
        ),
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(
          '222222',
          '참석자2'
        ),
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(
          '333333',
          '참석자3'
        ),
        testEnv.DB.prepare('INSERT INTO task_categories (category_id, name) VALUES (?, ?)').bind(
          'CAT-FIN',
          '재무'
        ),
        testEnv.DB.prepare('INSERT INTO task_categories (category_id, name) VALUES (?, ?)').bind(
          'CAT-HR',
          '인사'
        ),
        testEnv.DB.prepare('INSERT INTO task_categories (category_id, name) VALUES (?, ?)').bind(
          'CAT-ENG',
          '개발'
        ),
      ]);

      const meeting1 = await repository.create({
        meetingDate: '2026-03-05',
        topic: 'Budget sync',
        detailsRaw: 'Q2 budget planning',
        attendeePersonIds: ['111111'],
        categoryIds: ['CAT-FIN'],
      });
      const meeting2 = await repository.create({
        meetingDate: '2026-03-20',
        topic: 'Hiring plan',
        detailsRaw: 'Headcount budget discussion',
        attendeePersonIds: ['222222'],
        categoryIds: ['CAT-HR'],
      });
      const meeting3 = await repository.create({
        meetingDate: '2026-04-02',
        topic: 'Engineering retrospective',
        detailsRaw: 'Sprint retrospective',
        attendeePersonIds: ['333333'],
        categoryIds: ['CAT-ENG'],
      });

      const keywordResults = await repository.findAll({ q: 'budget' });
      expect(keywordResults.map((m) => m.meetingId)).toEqual(
        expect.arrayContaining([meeting1.meetingId, meeting2.meetingId])
      );
      expect(keywordResults.map((m) => m.meetingId)).not.toEqual(
        expect.arrayContaining([meeting3.meetingId])
      );

      const dateRangeResults = await repository.findAll({
        meetingDateFrom: '2026-03-01',
        meetingDateTo: '2026-03-31',
      });
      expect(dateRangeResults.map((m) => m.meetingId)).toEqual(
        expect.arrayContaining([meeting1.meetingId, meeting2.meetingId])
      );
      expect(dateRangeResults.map((m) => m.meetingId)).not.toEqual(
        expect.arrayContaining([meeting3.meetingId])
      );

      const categoryResults = await repository.findAll({ categoryId: 'CAT-ENG' });
      expect(categoryResults.map((m) => m.meetingId)).toEqual([meeting3.meetingId]);

      const attendeeResults = await repository.findAll({ attendeePersonId: '111111' });
      expect(attendeeResults.map((m) => m.meetingId)).toEqual([meeting1.meetingId]);

      const nonTokenSubstringResults = await repository.findAll({ q: 'oadm' });
      expect(nonTokenSubstringResults).toHaveLength(0);
    });
  });

  describe('findPaginated()', () => {
    it('returns paginated items and total count from database filtering', async () => {
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(
          '111111',
          '참석자1'
        ),
        testEnv.DB.prepare('INSERT INTO task_categories (category_id, name) VALUES (?, ?)').bind(
          'CAT-FIN',
          '재무'
        ),
      ]);

      const newer = await repository.create({
        meetingDate: '2026-03-20',
        topic: 'Budget roadmap sync',
        detailsRaw: 'Q2 budget and roadmap alignment',
        attendeePersonIds: ['111111'],
        categoryIds: ['CAT-FIN'],
      });
      const older = await repository.create({
        meetingDate: '2026-03-10',
        topic: 'Budget retrospective',
        detailsRaw: 'Reviewed budget usage',
        attendeePersonIds: ['111111'],
        categoryIds: ['CAT-FIN'],
      });

      const page1 = await repository.findPaginated({
        q: 'budget',
        attendeePersonId: '111111',
        categoryId: 'CAT-FIN',
        meetingDateFrom: '2026-03-01',
        meetingDateTo: '2026-03-31',
        page: 1,
        pageSize: 1,
      });

      expect(page1.total).toBe(2);
      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(1);
      expect(page1.items).toHaveLength(1);
      expect(page1.items[0]?.meetingId).toBe(newer.meetingId);

      const page2 = await repository.findPaginated({
        q: 'budget',
        attendeePersonId: '111111',
        categoryId: 'CAT-FIN',
        meetingDateFrom: '2026-03-01',
        meetingDateTo: '2026-03-31',
        page: 2,
        pageSize: 1,
      });

      expect(page2.total).toBe(2);
      expect(page2.items).toHaveLength(1);
      expect(page2.items[0]?.meetingId).toBe(older.meetingId);
    });
  });

  describe('delete()', () => {
    it('cascades join rows and removes linked work-note references', async () => {
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)').bind(
          '111111',
          '참석자1'
        ),
        testEnv.DB.prepare('INSERT INTO task_categories (category_id, name) VALUES (?, ?)').bind(
          'CAT-DEL',
          '삭제테스트'
        ),
      ]);

      const created = await repository.create({
        meetingDate: '2026-05-01',
        topic: '삭제 대상 회의',
        detailsRaw: '삭제 테스트',
        attendeePersonIds: ['111111'],
        categoryIds: ['CAT-DEL'],
      });

      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-DEL-001', '회의참조 노트', '내용', now, now),
        testEnv.DB.prepare(
          `INSERT INTO work_note_meeting_minute (work_id, meeting_id)
           VALUES (?, ?)`
        ).bind('WORK-DEL-001', created.meetingId),
      ]);

      await repository.delete(created.meetingId);

      const meetingRow = await testEnv.DB.prepare(
        'SELECT 1 FROM meeting_minutes WHERE meeting_id = ?'
      )
        .bind(created.meetingId)
        .first();
      expect(meetingRow).toBeNull();

      const attendeeRows = await testEnv.DB.prepare(
        'SELECT 1 FROM meeting_minute_person WHERE meeting_id = ?'
      )
        .bind(created.meetingId)
        .all();
      expect((attendeeRows.results || []).length).toBe(0);

      const categoryRows = await testEnv.DB.prepare(
        'SELECT 1 FROM meeting_minute_task_category WHERE meeting_id = ?'
      )
        .bind(created.meetingId)
        .all();
      expect((categoryRows.results || []).length).toBe(0);

      const linkRows = await testEnv.DB.prepare(
        'SELECT 1 FROM work_note_meeting_minute WHERE meeting_id = ?'
      )
        .bind(created.meetingId)
        .all();
      expect((linkRows.results || []).length).toBe(0);
    });
  });
});
