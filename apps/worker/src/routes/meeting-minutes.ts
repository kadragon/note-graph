import type { Context } from 'hono';
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

async function hasMeetingMinuteDuplicateTopic(
  c: Context<MeetingMinutesContext>,
  input: {
    meetingDate: string;
    topic: string;
    excludeMeetingId?: string;
  }
): Promise<boolean> {
  let sql = `SELECT topic FROM meeting_minutes WHERE meeting_date = ?`;
  const params: string[] = [input.meetingDate];

  if (input.excludeMeetingId) {
    sql += ' AND meeting_id <> ?';
    params.push(input.excludeMeetingId);
  }

  const result = await c.env.DB.prepare(sql)
    .bind(...params)
    .all<{ topic: string }>();

  return (result.results || []).some((row) => isHighlySimilarTopic(row.topic, input.topic));
}

meetingMinutes.get('/', queryValidator(listMeetingMinutesQuerySchema), async (c) => {
  const query = getValidatedQuery<typeof listMeetingMinutesQuerySchema>(c);

  const repository = new MeetingMinuteRepository(c.env.DB);
  const result = await repository.findPaginated({
    q: query.q,
    meetingDateFrom: query.meetingDateFrom,
    meetingDateTo: query.meetingDateTo,
    categoryId: query.categoryId,
    attendeePersonId: query.attendeePersonId,
    page: query.page,
    pageSize: query.pageSize,
  });

  return c.json(result);
});

meetingMinutes.post('/suggest', bodyValidator(suggestMeetingMinutesSchema), async (c) => {
  const body = getValidatedBody<typeof suggestMeetingMinutesSchema>(c);
  const limit = body.limit ?? 5;
  const meetingMinuteReferenceService = new MeetingMinuteReferenceService(c.env.DB);
  const meetingReferences = await meetingMinuteReferenceService.search(body.query, limit);

  return c.json({ meetingReferences });
});

meetingMinutes.get('/:meetingId', async (c) => {
  const meetingId = c.req.param('meetingId');

  const row = await c.env.DB.prepare(
    `SELECT
      meeting_id as meetingId,
      meeting_date as meetingDate,
      topic,
      details_raw as detailsRaw,
      keywords_json as keywordsJson,
      created_at as createdAt,
      updated_at as updatedAt
     FROM meeting_minutes
     WHERE meeting_id = ?`
  )
    .bind(meetingId)
    .first<{
      meetingId: string;
      meetingDate: string;
      topic: string;
      detailsRaw: string;
      keywordsJson: string;
      createdAt: string;
      updatedAt: string;
    }>();

  if (!row) {
    return notFoundJson(c, 'Meeting minute', meetingId);
  }

  const attendeesResult = await c.env.DB.prepare(
    `SELECT p.person_id as personId, p.name as name
       FROM meeting_minute_person mmp
       INNER JOIN persons p ON p.person_id = mmp.person_id
       WHERE mmp.meeting_id = ?
       ORDER BY p.person_id ASC`
  )
    .bind(meetingId)
    .all<{ personId: string; name: string }>();

  const categoriesResult = await c.env.DB.prepare(
    `SELECT tc.category_id as categoryId, tc.name as name
       FROM meeting_minute_task_category mmtc
       INNER JOIN task_categories tc ON tc.category_id = mmtc.category_id
       WHERE mmtc.meeting_id = ?
       ORDER BY tc.category_id ASC`
  )
    .bind(meetingId)
    .all<{ categoryId: string; name: string }>();

  const linkedWorkNoteCountRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as linkedWorkNoteCount
       FROM work_note_meeting_minute
       WHERE meeting_id = ?`
  )
    .bind(meetingId)
    .first<{ linkedWorkNoteCount: number }>();

  return c.json({
    meetingId: row.meetingId,
    meetingDate: row.meetingDate,
    topic: row.topic,
    detailsRaw: row.detailsRaw,
    keywords: JSON.parse(row.keywordsJson || '[]'),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    attendees: attendeesResult.results || [],
    categories: categoriesResult.results || [],
    linkedWorkNoteCount: Number(linkedWorkNoteCountRow?.linkedWorkNoteCount || 0),
  });
});

meetingMinutes.put('/:meetingId', bodyValidator(updateMeetingMinuteSchema), async (c) => {
  const meetingId = c.req.param('meetingId');
  const data = getValidatedBody<typeof updateMeetingMinuteSchema>(c);

  const existing = await c.env.DB.prepare(
    `SELECT meeting_id as meetingId, meeting_date as meetingDate, topic, details_raw as detailsRaw
       FROM meeting_minutes
       WHERE meeting_id = ?`
  )
    .bind(meetingId)
    .first<{
      meetingId: string;
      meetingDate: string;
      topic: string;
      detailsRaw: string;
    }>();

  if (!existing) {
    return notFoundJson(c, 'Meeting minute', meetingId);
  }

  if (data.meetingDate !== undefined || data.topic !== undefined) {
    const nextMeetingDate = data.meetingDate ?? existing.meetingDate;
    const nextTopic = data.topic ?? existing.topic;

    const hasDuplicate = await hasMeetingMinuteDuplicateTopic(c, {
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

  const keywordService = new MeetingMinuteKeywordService(c.env);
  const repository = new MeetingMinuteRepository(c.env.DB);

  const keywords = await keywordService.extractKeywords({
    topic: data.topic ?? existing.topic,
    detailsRaw: data.detailsRaw ?? existing.detailsRaw,
  });

  const updated = await repository.update(meetingId, {
    ...data,
    keywords,
  });

  const attendeesResult = await c.env.DB.prepare(
    `SELECT p.person_id as personId, p.name as name
       FROM meeting_minute_person mmp
       INNER JOIN persons p ON p.person_id = mmp.person_id
       WHERE mmp.meeting_id = ?
       ORDER BY p.person_id ASC`
  )
    .bind(meetingId)
    .all<{ personId: string; name: string }>();

  const categoriesResult = await c.env.DB.prepare(
    `SELECT tc.category_id as categoryId, tc.name as name
       FROM meeting_minute_task_category mmtc
       INNER JOIN task_categories tc ON tc.category_id = mmtc.category_id
       WHERE mmtc.meeting_id = ?
       ORDER BY tc.category_id ASC`
  )
    .bind(meetingId)
    .all<{ categoryId: string; name: string }>();

  return c.json({
    ...updated,
    attendees: attendeesResult.results || [],
    categories: categoriesResult.results || [],
  });
});

meetingMinutes.delete('/:meetingId', async (c) => {
  const meetingId = c.req.param('meetingId');
  const repository = new MeetingMinuteRepository(c.env.DB);
  await repository.delete(meetingId);
  return c.body(null, 204);
});

meetingMinutes.post('/', bodyValidator(createMeetingMinuteSchema), async (c) => {
  const data = getValidatedBody<typeof createMeetingMinuteSchema>(c);

  const hasDuplicate = await hasMeetingMinuteDuplicateTopic(c, {
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

  const keywordService = new MeetingMinuteKeywordService(c.env);
  const repository = new MeetingMinuteRepository(c.env.DB);
  const personRepository = new PersonRepository(c.env.DB);
  const categoryRepository = new TaskCategoryRepository(c.env.DB);

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

  return c.json(
    {
      ...created,
      attendees,
      categories,
    },
    201
  );
});

export default meetingMinutes;
