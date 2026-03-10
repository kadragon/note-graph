import { z } from 'zod';
import {
  bodyValidator,
  getValidatedBody,
  getValidatedQuery,
  queryValidator,
} from '../middleware/validation-middleware';
import { MeetingMinuteRepository } from '../repositories/meeting-minute-repository';
import { PersonRepository } from '../repositories/person-repository';
import { TaskCategoryRepository } from '../repositories/task-category-repository';
import {
  createMeetingMinuteSchema,
  listMeetingMinutesQuerySchema,
  updateMeetingMinuteSchema,
} from '../schemas/meeting-minute';
import { MeetingMinuteKeywordService } from '../services/meeting-minute-keyword-service';
import { MeetingMinuteReferenceService } from '../services/meeting-minute-reference-service';
import type { AppContext, AppVariables } from '../types/context';
import type { DatabaseClient } from '../types/database';
import { parseKeywordsJson } from '../utils/json-utils';
import { notFoundJson } from './_shared/route-responses';
import { createProtectedRouter } from './_shared/router-factory';

type MeetingMinutesContext = {
  Bindings: AppContext['Bindings'];
  Variables: AppVariables;
};

const meetingMinutes = createProtectedRouter<MeetingMinutesContext>();
const suggestMeetingMinutesSchema = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(20).optional(),
});

function normalizeTopicForDuplicateGuard(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^0-9a-zA-Z가-힣]/g, '')
    .trim();
}

function isHighlySimilarTopic(left: string, right: string): boolean {
  const leftNormalized = normalizeTopicForDuplicateGuard(left);
  const rightNormalized = normalizeTopicForDuplicateGuard(right);

  if (!leftNormalized || !rightNormalized) {
    return false;
  }

  if (leftNormalized === rightNormalized) {
    return true;
  }

  const [shorter, longer] =
    leftNormalized.length <= rightNormalized.length
      ? [leftNormalized, rightNormalized]
      : [rightNormalized, leftNormalized];

  return shorter.length >= 8 && longer.includes(shorter);
}

async function getMeetingMinuteGroups(db: DatabaseClient, meetingId: string) {
  const { rows } = await db.query<{ groupId: string; name: string }>(
    `SELECT wng.group_id as "groupId", wng.name as name
     FROM meeting_minute_group mmg
     INNER JOIN work_note_groups wng ON wng.group_id = mmg.group_id
     WHERE mmg.meeting_id = $1
     ORDER BY wng.group_id ASC`,
    [meetingId]
  );
  return rows;
}

async function hasMeetingMinuteDuplicateTopic(
  db: DatabaseClient,
  input: {
    meetingDate: string;
    topic: string;
    excludeMeetingId?: string;
  }
): Promise<boolean> {
  let sql = `SELECT topic FROM meeting_minutes WHERE meeting_date = $1`;
  const params: string[] = [input.meetingDate];

  if (input.excludeMeetingId) {
    sql += ' AND meeting_id <> $2';
    params.push(input.excludeMeetingId);
  }

  const { rows } = await db.query<{ topic: string }>(sql, params);

  return rows.some((row) => isHighlySimilarTopic(row.topic, input.topic));
}

meetingMinutes.get('/', queryValidator(listMeetingMinutesQuerySchema), async (c) => {
  const query = getValidatedQuery<typeof listMeetingMinutesQuerySchema>(c);
  const db = c.get('db');

  const repository = new MeetingMinuteRepository(db);
  const result = await repository.findPaginated({
    q: query.q,
    meetingDateFrom: query.meetingDateFrom,
    meetingDateTo: query.meetingDateTo,
    categoryId: query.categoryId,
    groupId: query.groupId,
    attendeePersonId: query.attendeePersonId,
    page: query.page,
    pageSize: query.pageSize,
  });

  return c.json(result);
});

meetingMinutes.post('/suggest', bodyValidator(suggestMeetingMinutesSchema), async (c) => {
  const body = getValidatedBody<typeof suggestMeetingMinutesSchema>(c);
  const limit = body.limit ?? 5;
  const meetingMinuteReferenceService = new MeetingMinuteReferenceService(c.get('db'));
  const meetingReferences = await meetingMinuteReferenceService.search(body.query, limit);

  return c.json({ meetingReferences });
});

meetingMinutes.get('/:meetingId', async (c) => {
  const meetingId = c.req.param('meetingId')!;
  const db = c.get('db');

  const row = await db.queryOne<{
    meetingId: string;
    meetingDate: string;
    topic: string;
    detailsRaw: string;
    keywordsJson: string;
    createdAt: string;
    updatedAt: string;
  }>(
    `SELECT
      meeting_id as "meetingId",
      meeting_date as "meetingDate",
      topic,
      details_raw as "detailsRaw",
      keywords_json as "keywordsJson",
      created_at as "createdAt",
      updated_at as "updatedAt"
     FROM meeting_minutes
     WHERE meeting_id = $1`,
    [meetingId]
  );

  if (!row) {
    return notFoundJson(c, 'Meeting minute', meetingId);
  }

  const [attendeesResult, categoriesResult, groups, linkedWorkNoteCountRow] = await Promise.all([
    db.query<{ personId: string; name: string }>(
      `SELECT p.person_id as "personId", p.name as name
         FROM meeting_minute_person mmp
         INNER JOIN persons p ON p.person_id = mmp.person_id
         WHERE mmp.meeting_id = $1
         ORDER BY p.person_id ASC`,
      [meetingId]
    ),
    db.query<{ categoryId: string; name: string }>(
      `SELECT tc.category_id as "categoryId", tc.name as name
         FROM meeting_minute_task_category mmtc
         INNER JOIN task_categories tc ON tc.category_id = mmtc.category_id
         WHERE mmtc.meeting_id = $1
         ORDER BY tc.category_id ASC`,
      [meetingId]
    ),
    getMeetingMinuteGroups(db, meetingId),
    db.queryOne<{ linkedWorkNoteCount: number }>(
      `SELECT COUNT(*) as "linkedWorkNoteCount"
         FROM work_note_meeting_minute
         WHERE meeting_id = $1`,
      [meetingId]
    ),
  ]);

  return c.json({
    meetingId: row.meetingId,
    meetingDate: row.meetingDate,
    topic: row.topic,
    detailsRaw: row.detailsRaw,
    keywords: parseKeywordsJson(row.keywordsJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    attendees: attendeesResult.rows,
    categories: categoriesResult.rows,
    groups,
    linkedWorkNoteCount: Number(linkedWorkNoteCountRow?.linkedWorkNoteCount || 0),
  });
});

meetingMinutes.put('/:meetingId', bodyValidator(updateMeetingMinuteSchema), async (c) => {
  const meetingId = c.req.param('meetingId')!;
  const data = getValidatedBody<typeof updateMeetingMinuteSchema>(c);
  const db = c.get('db');

  const existing = await db.queryOne<{
    meetingId: string;
    meetingDate: string;
    topic: string;
    detailsRaw: string;
  }>(
    `SELECT meeting_id as "meetingId", meeting_date as "meetingDate", topic, details_raw as "detailsRaw"
       FROM meeting_minutes
       WHERE meeting_id = $1`,
    [meetingId]
  );

  if (!existing) {
    return notFoundJson(c, 'Meeting minute', meetingId);
  }

  if (data.meetingDate !== undefined || data.topic !== undefined) {
    const nextMeetingDate = data.meetingDate ?? existing.meetingDate;
    const nextTopic = data.topic ?? existing.topic;

    const hasDuplicate = await hasMeetingMinuteDuplicateTopic(db, {
      meetingDate: nextMeetingDate,
      topic: nextTopic,
      excludeMeetingId: meetingId,
    });

    if (hasDuplicate) {
      return c.json(
        {
          code: 'CONFLICT',
          message: 'A meeting minute with the same date and similar topic already exists',
        },
        409
      );
    }
  }

  const keywordService = new MeetingMinuteKeywordService(c.env, c.get('settingService'));
  const repository = new MeetingMinuteRepository(db);

  const keywords = await keywordService.extractKeywords({
    topic: data.topic ?? existing.topic,
    detailsRaw: data.detailsRaw ?? existing.detailsRaw,
  });

  const updated = await repository.update(meetingId, {
    ...data,
    keywords,
  });

  const [attendeesResult, categoriesResult, groups] = await Promise.all([
    db.query<{ personId: string; name: string }>(
      `SELECT p.person_id as "personId", p.name as name
         FROM meeting_minute_person mmp
         INNER JOIN persons p ON p.person_id = mmp.person_id
         WHERE mmp.meeting_id = $1
         ORDER BY p.person_id ASC`,
      [meetingId]
    ),
    db.query<{ categoryId: string; name: string }>(
      `SELECT tc.category_id as "categoryId", tc.name as name
         FROM meeting_minute_task_category mmtc
         INNER JOIN task_categories tc ON tc.category_id = mmtc.category_id
         WHERE mmtc.meeting_id = $1
         ORDER BY tc.category_id ASC`,
      [meetingId]
    ),
    getMeetingMinuteGroups(db, meetingId),
  ]);

  return c.json({
    ...updated,
    attendees: attendeesResult.rows,
    categories: categoriesResult.rows,
    groups,
  });
});

meetingMinutes.delete('/:meetingId', async (c) => {
  const meetingId = c.req.param('meetingId')!;
  const repository = new MeetingMinuteRepository(c.get('db'));
  await repository.delete(meetingId);
  return c.body(null, 204);
});

meetingMinutes.post('/', bodyValidator(createMeetingMinuteSchema), async (c) => {
  const data = getValidatedBody<typeof createMeetingMinuteSchema>(c);

  const db = c.get('db');

  const hasDuplicate = await hasMeetingMinuteDuplicateTopic(db, {
    meetingDate: data.meetingDate,
    topic: data.topic,
  });

  if (hasDuplicate) {
    return c.json(
      {
        code: 'CONFLICT',
        message: 'A meeting minute with the same date and similar topic already exists',
      },
      409
    );
  }

  const keywordService = new MeetingMinuteKeywordService(c.env, c.get('settingService'));
  const repository = new MeetingMinuteRepository(db);
  const personRepository = new PersonRepository(db);
  const categoryRepository = new TaskCategoryRepository(db);

  const keywords = await keywordService.extractKeywords({
    topic: data.topic,
    detailsRaw: data.detailsRaw,
  });

  const created = await repository.create({
    ...data,
    keywords,
  });

  const [persons, taskCategories] = await Promise.all([
    personRepository.findByIds(data.attendeePersonIds),
    categoryRepository.findByIds(data.categoryIds || []),
  ]);

  const attendees = persons.map((person) => ({
    personId: person.personId,
    name: person.name,
  }));

  const categories = taskCategories.map((category) => ({
    categoryId: category.categoryId,
    name: category.name,
  }));

  const groups = await getMeetingMinuteGroups(db, created.meetingId);

  return c.json(
    {
      ...created,
      attendees,
      categories,
      groups,
    },
    201
  );
});

export default meetingMinutes;
