import { nanoid } from 'nanoid';
import { D1FtsDialect } from '../adapters/d1-fts-dialect';
import type { CreateMeetingMinuteInput, UpdateMeetingMinuteInput } from '../schemas/meeting-minute';
import type { DatabaseClient } from '../types/database';
import { NotFoundError } from '../types/errors';
import type { FtsDialect } from '../types/fts-dialect';
import { parseKeywordsJson } from '../utils/json-utils';
import {
  buildMeetingMinutesFtsQuery,
  buildMeetingMinutesTsQuery,
} from '../utils/meeting-minutes-fts';

export interface MeetingMinute {
  meetingId: string;
  meetingDate: string;
  topic: string;
  detailsRaw: string;
  keywords: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ListMeetingMinutesQuery {
  q?: string;
  meetingDateFrom?: string;
  meetingDateTo?: string;
  categoryId?: string;
  groupId?: string;
  attendeePersonId?: string;
}

export interface PaginatedMeetingMinutesQuery extends ListMeetingMinutesQuery {
  page: number;
  pageSize: number;
}

export interface PaginatedMeetingMinutesResult {
  items: MeetingMinute[];
  total: number;
  page: number;
  pageSize: number;
}

export class MeetingMinuteRepository {
  constructor(
    private db: DatabaseClient,
    private dialect: FtsDialect = new D1FtsDialect()
  ) {}

  private generateMeetingId(): string {
    return `MEET-${nanoid()}`;
  }

  async create(
    data: CreateMeetingMinuteInput & {
      keywords?: string[];
    }
  ): Promise<MeetingMinute> {
    const meetingId = this.generateMeetingId();
    const now = new Date().toISOString();
    const keywords = data.keywords || [];
    const keywordsJson = JSON.stringify(keywords);
    const keywordsText = keywords.join(' ');

    const statements: Array<{ sql: string; params?: unknown[] }> = [
      {
        sql: `INSERT INTO meeting_minutes (
               meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          meetingId,
          data.meetingDate,
          data.topic,
          data.detailsRaw,
          keywordsJson,
          keywordsText,
          now,
          now,
        ],
      },
    ];

    for (const personId of data.attendeePersonIds) {
      statements.push({
        sql: `INSERT INTO meeting_minute_person (meeting_id, person_id) VALUES (?, ?)`,
        params: [meetingId, personId],
      });
    }

    if (data.categoryIds && data.categoryIds.length > 0) {
      for (const categoryId of data.categoryIds) {
        statements.push({
          sql: `INSERT INTO meeting_minute_task_category (meeting_id, category_id) VALUES (?, ?)`,
          params: [meetingId, categoryId],
        });
      }
    }

    if (data.groupIds && data.groupIds.length > 0) {
      for (const groupId of data.groupIds) {
        statements.push({
          sql: `INSERT INTO meeting_minute_group (meeting_id, group_id) VALUES (?, ?)`,
          params: [meetingId, groupId],
        });
      }
    }

    await this.db.executeBatch(statements);

    return {
      meetingId,
      meetingDate: data.meetingDate,
      topic: data.topic,
      detailsRaw: data.detailsRaw,
      keywords,
      createdAt: now,
      updatedAt: now,
    };
  }

  async update(
    meetingId: string,
    data: UpdateMeetingMinuteInput & {
      keywords?: string[];
    }
  ): Promise<MeetingMinute> {
    const existing = await this.db.queryOne<{
      meetingId: string;
      meetingDate: string;
      topic: string;
      detailsRaw: string;
      keywordsJson: string;
      createdAt: string;
      updatedAt: string;
    }>(
      `SELECT meeting_id as meetingId, meeting_date as meetingDate, topic, details_raw as detailsRaw,
              keywords_json as keywordsJson, created_at as createdAt, updated_at as updatedAt
       FROM meeting_minutes
       WHERE meeting_id = ?`,
      [meetingId]
    );

    if (!existing) {
      throw new NotFoundError('Meeting minute', meetingId);
    }

    const now = new Date().toISOString();
    const nextKeywords = data.keywords ?? parseKeywordsJson(existing.keywordsJson);
    const nextKeywordsJson = JSON.stringify(nextKeywords);
    const nextKeywordsText = nextKeywords.join(' ');

    const fields: string[] = ['updated_at = ?'];
    const params: (string | null)[] = [now];

    if (data.meetingDate !== undefined) {
      fields.push('meeting_date = ?');
      params.push(data.meetingDate);
    }
    if (data.topic !== undefined) {
      fields.push('topic = ?');
      params.push(data.topic);
    }
    if (data.detailsRaw !== undefined) {
      fields.push('details_raw = ?');
      params.push(data.detailsRaw);
    }
    if (data.keywords !== undefined) {
      fields.push('keywords_json = ?');
      params.push(nextKeywordsJson);
      fields.push('keywords_text = ?');
      params.push(nextKeywordsText);
    }

    await this.db.execute(
      `UPDATE meeting_minutes
       SET ${fields.join(', ')}
       WHERE meeting_id = ?`,
      [...params, meetingId]
    );

    const statements: Array<{ sql: string; params?: unknown[] }> = [];

    if (data.attendeePersonIds !== undefined) {
      statements.push({
        sql: `DELETE FROM meeting_minute_person WHERE meeting_id = ?`,
        params: [meetingId],
      });

      for (const personId of data.attendeePersonIds) {
        statements.push({
          sql: `INSERT INTO meeting_minute_person (meeting_id, person_id) VALUES (?, ?)`,
          params: [meetingId, personId],
        });
      }
    }

    if (data.categoryIds !== undefined) {
      statements.push({
        sql: `DELETE FROM meeting_minute_task_category WHERE meeting_id = ?`,
        params: [meetingId],
      });

      for (const categoryId of data.categoryIds) {
        statements.push({
          sql: `INSERT INTO meeting_minute_task_category (meeting_id, category_id) VALUES (?, ?)`,
          params: [meetingId, categoryId],
        });
      }
    }

    if (data.groupIds !== undefined) {
      statements.push({
        sql: `DELETE FROM meeting_minute_group WHERE meeting_id = ?`,
        params: [meetingId],
      });

      for (const groupId of data.groupIds) {
        statements.push({
          sql: `INSERT INTO meeting_minute_group (meeting_id, group_id) VALUES (?, ?)`,
          params: [meetingId, groupId],
        });
      }
    }

    if (statements.length > 0) {
      await this.db.executeBatch(statements);
    }

    return {
      meetingId,
      meetingDate: data.meetingDate ?? existing.meetingDate,
      topic: data.topic ?? existing.topic,
      detailsRaw: data.detailsRaw ?? existing.detailsRaw,
      keywords: nextKeywords,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
  }

  async findPaginated(query: PaginatedMeetingMinutesQuery): Promise<PaginatedMeetingMinutesResult> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.max(1, query.pageSize || 20);
    const offset = (page - 1) * pageSize;

    let withClause = '';
    const joins: string[] = [];
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (query.q && query.q.trim().length > 0) {
      const ftsQuery = this.dialect.isTsQuerySyntax()
        ? buildMeetingMinutesTsQuery(query.q)
        : buildMeetingMinutesFtsQuery(query.q);
      if (!ftsQuery) {
        return { items: [], total: 0, page, pageSize };
      }

      const cte = this.dialect.buildMeetingMinuteFilterCte();
      withClause = cte.sql;
      joins.push(`INNER JOIN fts_matches fts ON ${cte.joinCondition}`);
      params.push(ftsQuery);
    }

    if (query.categoryId) {
      joins.push(
        `INNER JOIN meeting_minute_task_category mmtc
          ON mm.meeting_id = mmtc.meeting_id`
      );
      conditions.push('mmtc.category_id = ?');
      params.push(query.categoryId);
    }

    if (query.groupId) {
      joins.push(
        `INNER JOIN meeting_minute_group mmg
          ON mm.meeting_id = mmg.meeting_id`
      );
      conditions.push('mmg.group_id = ?');
      params.push(query.groupId);
    }

    if (query.attendeePersonId) {
      joins.push(
        `INNER JOIN meeting_minute_person mmp
          ON mm.meeting_id = mmp.meeting_id`
      );
      conditions.push('mmp.person_id = ?');
      params.push(query.attendeePersonId);
    }

    if (query.meetingDateFrom) {
      conditions.push('mm.meeting_date >= ?');
      params.push(query.meetingDateFrom);
    }

    if (query.meetingDateTo) {
      conditions.push('mm.meeting_date <= ?');
      params.push(query.meetingDateTo);
    }

    const joinClause = joins.length > 0 ? `\n${joins.join('\n')}` : '';
    const whereClause = conditions.length > 0 ? `\nWHERE ${conditions.join(' AND ')}` : '';

    const totalSql = `
      ${withClause}
      SELECT COUNT(mm.meeting_id) as total
      FROM meeting_minutes mm${joinClause}${whereClause}
    `;

    const totalRow = await this.db.queryOne<{ total: number }>(totalSql, params);

    let sql = `
      ${withClause}
      SELECT
        mm.meeting_id as meetingId,
        mm.meeting_date as meetingDate,
        mm.topic,
        mm.details_raw as detailsRaw,
        mm.keywords_json as keywordsJson,
        mm.created_at as createdAt,
        mm.updated_at as updatedAt
      FROM meeting_minutes mm
    `;
    sql += joinClause;
    sql += whereClause;
    sql += ` ORDER BY mm.meeting_date DESC, mm.updated_at DESC, mm.meeting_id DESC`;
    sql += ` LIMIT ? OFFSET ?`;

    const result = await this.db.query<{
      meetingId: string;
      meetingDate: string;
      topic: string;
      detailsRaw: string;
      keywordsJson: string;
      createdAt: string;
      updatedAt: string;
    }>(sql, [...params, pageSize, offset]);

    const items = result.rows.map((row) => ({
      meetingId: row.meetingId,
      meetingDate: row.meetingDate,
      topic: row.topic,
      detailsRaw: row.detailsRaw,
      keywords: parseKeywordsJson(row.keywordsJson),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return {
      items,
      total: Number(totalRow?.total || 0),
      page,
      pageSize,
    };
  }

  async findAll(query: ListMeetingMinutesQuery = {}): Promise<MeetingMinute[]> {
    const result = await this.findPaginated({
      ...query,
      page: 1,
      pageSize: 1000000,
    });
    return result.items;
  }

  async delete(meetingId: string): Promise<void> {
    const existing = await this.db.queryOne<{ meeting_id: string }>(
      'SELECT meeting_id FROM meeting_minutes WHERE meeting_id = ?',
      [meetingId]
    );

    if (!existing) {
      throw new NotFoundError('Meeting minute', meetingId);
    }

    await this.db.execute('DELETE FROM meeting_minutes WHERE meeting_id = ?', [meetingId]);
  }
}
