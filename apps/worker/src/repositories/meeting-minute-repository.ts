import { nanoid } from 'nanoid';
import { buildMeetingMinuteFilterCte } from '../adapters/postgres-fts-dialect';
import type { CreateMeetingMinuteInput, UpdateMeetingMinuteInput } from '../schemas/meeting-minute';
import type { DatabaseClient } from '../types/database';
import { NotFoundError } from '../types/errors';
import { buildMultiRowInsert } from '../utils/db-utils';
import { parseKeywordsJson } from '../utils/json-utils';
import { buildMeetingMinutesTsQuery } from '../utils/meeting-minutes-fts';

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
  constructor(private db: DatabaseClient) {}

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
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
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

    if (data.attendeePersonIds.length > 0) {
      statements.push(
        buildMultiRowInsert(
          'meeting_minute_person',
          ['meeting_id', 'person_id'],
          data.attendeePersonIds.map((id) => [meetingId, id])
        )
      );
    }

    if (data.categoryIds && data.categoryIds.length > 0) {
      statements.push(
        buildMultiRowInsert(
          'meeting_minute_task_category',
          ['meeting_id', 'category_id'],
          data.categoryIds.map((id) => [meetingId, id])
        )
      );
    }

    if (data.groupIds && data.groupIds.length > 0) {
      statements.push(
        buildMultiRowInsert(
          'meeting_minute_group',
          ['meeting_id', 'group_id'],
          data.groupIds.map((id) => [meetingId, id])
        )
      );
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
      `SELECT meeting_id as "meetingId", meeting_date as "meetingDate", topic, details_raw as "detailsRaw",
              keywords_json as "keywordsJson", created_at as "createdAt", updated_at as "updatedAt"
       FROM meeting_minutes
       WHERE meeting_id = $1`,
      [meetingId]
    );

    if (!existing) {
      throw new NotFoundError('Meeting minute', meetingId);
    }

    const now = new Date().toISOString();
    const nextKeywords = data.keywords ?? parseKeywordsJson(existing.keywordsJson);
    const nextKeywordsJson = JSON.stringify(nextKeywords);
    const nextKeywordsText = nextKeywords.join(' ');

    const fields: string[] = [];
    const params: (string | null)[] = [];
    let paramIndex = 1;

    fields.push(`updated_at = $${paramIndex++}`);
    params.push(now);

    if (data.meetingDate !== undefined) {
      fields.push(`meeting_date = $${paramIndex++}`);
      params.push(data.meetingDate);
    }
    if (data.topic !== undefined) {
      fields.push(`topic = $${paramIndex++}`);
      params.push(data.topic);
    }
    if (data.detailsRaw !== undefined) {
      fields.push(`details_raw = $${paramIndex++}`);
      params.push(data.detailsRaw);
    }
    if (data.keywords !== undefined) {
      fields.push(`keywords_json = $${paramIndex++}`);
      params.push(nextKeywordsJson);
      fields.push(`keywords_text = $${paramIndex++}`);
      params.push(nextKeywordsText);
    }

    // Reset embedding only when content actually changes
    const contentChanged =
      (data.topic !== undefined && data.topic !== existing.topic) ||
      (data.detailsRaw !== undefined && data.detailsRaw !== existing.detailsRaw) ||
      (data.keywords !== undefined && nextKeywordsJson !== existing.keywordsJson);
    if (contentChanged) {
      fields.push('embedded_at = NULL');
    }

    params.push(meetingId);
    await this.db.execute(
      `UPDATE meeting_minutes
       SET ${fields.join(', ')}
       WHERE meeting_id = $${paramIndex}`,
      params
    );

    const statements: Array<{ sql: string; params?: unknown[] }> = [];

    if (data.attendeePersonIds !== undefined) {
      if (data.attendeePersonIds.length === 0) {
        statements.push({
          sql: `DELETE FROM meeting_minute_person WHERE meeting_id = $1`,
          params: [meetingId],
        });
      } else {
        const inPlaceholders = data.attendeePersonIds.map((_, i) => `$${i + 2}`).join(', ');
        statements.push({
          sql: `DELETE FROM meeting_minute_person WHERE meeting_id = $1 AND person_id NOT IN (${inPlaceholders})`,
          params: [meetingId, ...data.attendeePersonIds],
        });
        statements.push(
          buildMultiRowInsert(
            'meeting_minute_person',
            ['meeting_id', 'person_id'],
            data.attendeePersonIds.map((id) => [meetingId, id]),
            'ON CONFLICT DO NOTHING'
          )
        );
      }
    }

    if (data.categoryIds !== undefined) {
      if (data.categoryIds.length === 0) {
        statements.push({
          sql: `DELETE FROM meeting_minute_task_category WHERE meeting_id = $1`,
          params: [meetingId],
        });
      } else {
        const inPlaceholders = data.categoryIds.map((_, i) => `$${i + 2}`).join(', ');
        statements.push({
          sql: `DELETE FROM meeting_minute_task_category WHERE meeting_id = $1 AND category_id NOT IN (${inPlaceholders})`,
          params: [meetingId, ...data.categoryIds],
        });
        statements.push(
          buildMultiRowInsert(
            'meeting_minute_task_category',
            ['meeting_id', 'category_id'],
            data.categoryIds.map((id) => [meetingId, id]),
            'ON CONFLICT DO NOTHING'
          )
        );
      }
    }

    if (data.groupIds !== undefined) {
      if (data.groupIds.length === 0) {
        statements.push({
          sql: `DELETE FROM meeting_minute_group WHERE meeting_id = $1`,
          params: [meetingId],
        });
      } else {
        const inPlaceholders = data.groupIds.map((_, i) => `$${i + 2}`).join(', ');
        statements.push({
          sql: `DELETE FROM meeting_minute_group WHERE meeting_id = $1 AND group_id NOT IN (${inPlaceholders})`,
          params: [meetingId, ...data.groupIds],
        });
        statements.push(
          buildMultiRowInsert(
            'meeting_minute_group',
            ['meeting_id', 'group_id'],
            data.groupIds.map((id) => [meetingId, id]),
            'ON CONFLICT DO NOTHING'
          )
        );
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
    let paramIndex = 1;

    if (query.q && query.q.trim().length > 0) {
      const ftsQuery = buildMeetingMinutesTsQuery(query.q);
      if (!ftsQuery) {
        return { items: [], total: 0, page, pageSize };
      }

      const cte = buildMeetingMinuteFilterCte();
      withClause = cte.sql;
      joins.push(`INNER JOIN fts_matches fts ON ${cte.joinCondition}`);
      params.push(ftsQuery);
      paramIndex++;
    }

    if (query.categoryId) {
      joins.push(
        `INNER JOIN meeting_minute_task_category mmtc
          ON mm.meeting_id = mmtc.meeting_id`
      );
      conditions.push(`mmtc.category_id = $${paramIndex++}`);
      params.push(query.categoryId);
    }

    if (query.groupId) {
      joins.push(
        `INNER JOIN meeting_minute_group mmg
          ON mm.meeting_id = mmg.meeting_id`
      );
      conditions.push(`mmg.group_id = $${paramIndex++}`);
      params.push(query.groupId);
    }

    if (query.attendeePersonId) {
      joins.push(
        `INNER JOIN meeting_minute_person mmp
          ON mm.meeting_id = mmp.meeting_id`
      );
      conditions.push(`mmp.person_id = $${paramIndex++}`);
      params.push(query.attendeePersonId);
    }

    if (query.meetingDateFrom) {
      conditions.push(`mm.meeting_date >= $${paramIndex++}`);
      params.push(query.meetingDateFrom);
    }

    if (query.meetingDateTo) {
      conditions.push(`mm.meeting_date <= $${paramIndex++}`);
      params.push(query.meetingDateTo);
    }

    const joinClause = joins.length > 0 ? `\n${joins.join('\n')}` : '';
    const whereClause = conditions.length > 0 ? `\nWHERE ${conditions.join(' AND ')}` : '';

    const totalSql = `
      ${withClause}
      SELECT COUNT(mm.meeting_id) as "total"
      FROM meeting_minutes mm${joinClause}${whereClause}
    `;

    const totalRow = await this.db.queryOne<{ total: number }>(totalSql, params);

    let sql = `
      ${withClause}
      SELECT
        mm.meeting_id as "meetingId",
        mm.meeting_date as "meetingDate",
        mm.topic,
        mm.details_raw as "detailsRaw",
        mm.keywords_json as "keywordsJson",
        mm.created_at as "createdAt",
        mm.updated_at as "updatedAt"
      FROM meeting_minutes mm
    `;
    sql += joinClause;
    sql += whereClause;
    sql += ` ORDER BY mm.meeting_date DESC, mm.updated_at DESC, mm.meeting_id DESC`;
    sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;

    const result = await this.db.query<{
      meetingId: string;
      meetingDate: string;
      topic: string;
      detailsRaw: string;
      keywordsJson: string;
      createdAt: string;
      updatedAt: string;
    }>(sql, [...params, pageSize, offset]);

    const total = Number(totalRow?.total || 0);
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
      total,
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

  async findById(meetingId: string): Promise<MeetingMinute | null> {
    const row = await this.db.queryOne<{
      meetingId: string;
      meetingDate: string;
      topic: string;
      detailsRaw: string;
      keywordsJson: string;
      createdAt: string;
      updatedAt: string;
    }>(
      `SELECT meeting_id as "meetingId", meeting_date as "meetingDate", topic, details_raw as "detailsRaw",
              keywords_json as "keywordsJson", created_at as "createdAt", updated_at as "updatedAt"
       FROM meeting_minutes
       WHERE meeting_id = $1`,
      [meetingId]
    );

    if (!row) return null;

    return {
      meetingId: row.meetingId,
      meetingDate: row.meetingDate,
      topic: row.topic,
      detailsRaw: row.detailsRaw,
      keywords: parseKeywordsJson(row.keywordsJson),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async delete(meetingId: string): Promise<void> {
    const existing = await this.db.queryOne<{ meeting_id: string }>(
      'SELECT meeting_id FROM meeting_minutes WHERE meeting_id = $1',
      [meetingId]
    );

    if (!existing) {
      throw new NotFoundError('Meeting minute', meetingId);
    }

    await this.db.execute('DELETE FROM meeting_minutes WHERE meeting_id = $1', [meetingId]);
  }

  // ============================================================================
  // Embedding support
  // ============================================================================

  async clearEmbeddedAt(meetingId: string): Promise<void> {
    await this.db.execute(
      'UPDATE meeting_minutes SET embedded_at = NULL, updated_at = $1 WHERE meeting_id = $2',
      [new Date().toISOString(), meetingId]
    );
  }

  async updateEmbeddedAt(meetingId: string): Promise<void> {
    await this.db.execute('UPDATE meeting_minutes SET embedded_at = $1 WHERE meeting_id = $2', [
      new Date().toISOString(),
      meetingId,
    ]);
  }

  async updateEmbeddedAtIfUpdatedAtMatches(
    meetingId: string,
    expectedUpdatedAt: string
  ): Promise<boolean> {
    const result = await this.db.execute(
      `UPDATE meeting_minutes SET embedded_at = $1 WHERE meeting_id = $2 AND updated_at = $3`,
      [new Date().toISOString(), meetingId, expectedUpdatedAt]
    );
    return result.rowCount > 0;
  }

  async findPendingEmbedding(limit: number = 10): Promise<MeetingMinute[]> {
    const rows = await this.db.query<{
      meetingId: string;
      meetingDate: string;
      topic: string;
      detailsRaw: string;
      keywordsJson: string;
      createdAt: string;
      updatedAt: string;
    }>(
      `SELECT meeting_id as "meetingId", meeting_date as "meetingDate", topic, details_raw as "detailsRaw",
              keywords_json as "keywordsJson", created_at as "createdAt", updated_at as "updatedAt"
       FROM meeting_minutes
       WHERE embedded_at IS NULL
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );

    return rows.rows.map((row) => ({
      meetingId: row.meetingId,
      meetingDate: row.meetingDate,
      topic: row.topic,
      detailsRaw: row.detailsRaw,
      keywords: parseKeywordsJson(row.keywordsJson),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async getEmbeddingStats(): Promise<{ total: number; embedded: number; pending: number }> {
    const result = await this.db.queryOne<{ total: number; embedded: number; pending: number }>(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN embedded_at IS NOT NULL THEN 1 ELSE 0 END) as embedded,
         SUM(CASE WHEN embedded_at IS NULL THEN 1 ELSE 0 END) as pending
       FROM meeting_minutes`
    );
    return {
      total: result?.total || 0,
      embedded: result?.embedded || 0,
      pending: result?.pending || 0,
    };
  }

  async findAttendeePersonIds(meetingId: string): Promise<string[]> {
    const rows = await this.db.query<{ personId: string }>(
      'SELECT person_id as "personId" FROM meeting_minute_person WHERE meeting_id = $1',
      [meetingId]
    );
    return rows.rows.map((r) => r.personId);
  }

  async findAttendeePersonIdsByMeetingIds(meetingIds: string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    if (meetingIds.length === 0) return result;

    const placeholders = meetingIds.map((_, i) => `$${i + 1}`).join(',');
    const rows = await this.db.query<{ meetingId: string; personId: string }>(
      `SELECT meeting_id as "meetingId", person_id as "personId"
       FROM meeting_minute_person
       WHERE meeting_id IN (${placeholders})`,
      meetingIds
    );

    for (const row of rows.rows) {
      const list = result.get(row.meetingId) || [];
      list.push(row.personId);
      result.set(row.meetingId, list);
    }

    return result;
  }
}
