import type { D1Database } from '@cloudflare/workers-types';
import { nanoid } from 'nanoid';
import type { CreateMeetingMinuteInput, UpdateMeetingMinuteInput } from '../schemas/meeting-minute';
import { NotFoundError } from '../types/errors';

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
  attendeePersonId?: string;
}

export class MeetingMinuteRepository {
  constructor(private db: D1Database) {}

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

    const statements: ReturnType<D1Database['prepare']>[] = [
      this.db
        .prepare(
          `INSERT INTO meeting_minutes (
             meeting_id, meeting_date, topic, details_raw, keywords_json, keywords_text, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          meetingId,
          data.meetingDate,
          data.topic,
          data.detailsRaw,
          keywordsJson,
          keywordsText,
          now,
          now
        ),
    ];

    for (const personId of data.attendeePersonIds) {
      statements.push(
        this.db
          .prepare(
            `INSERT INTO meeting_minute_person (meeting_id, person_id)
             VALUES (?, ?)`
          )
          .bind(meetingId, personId)
      );
    }

    if (data.categoryIds && data.categoryIds.length > 0) {
      for (const categoryId of data.categoryIds) {
        statements.push(
          this.db
            .prepare(
              `INSERT INTO meeting_minute_task_category (meeting_id, category_id)
               VALUES (?, ?)`
            )
            .bind(meetingId, categoryId)
        );
      }
    }

    await this.db.batch(statements);

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
    const existing = await this.db
      .prepare(
        `SELECT meeting_id as meetingId, meeting_date as meetingDate, topic, details_raw as detailsRaw,
                keywords_json as keywordsJson, created_at as createdAt, updated_at as updatedAt
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

    if (!existing) {
      throw new NotFoundError('Meeting minute', meetingId);
    }

    const now = new Date().toISOString();
    const nextKeywords = data.keywords ?? JSON.parse(existing.keywordsJson || '[]');
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

    await this.db
      .prepare(
        `UPDATE meeting_minutes
         SET ${fields.join(', ')}
         WHERE meeting_id = ?`
      )
      .bind(...params, meetingId)
      .run();

    const statements: ReturnType<D1Database['prepare']>[] = [];

    if (data.attendeePersonIds !== undefined) {
      statements.push(
        this.db.prepare(`DELETE FROM meeting_minute_person WHERE meeting_id = ?`).bind(meetingId)
      );

      for (const personId of data.attendeePersonIds) {
        statements.push(
          this.db
            .prepare(
              `INSERT INTO meeting_minute_person (meeting_id, person_id)
               VALUES (?, ?)`
            )
            .bind(meetingId, personId)
        );
      }
    }

    if (data.categoryIds !== undefined) {
      statements.push(
        this.db
          .prepare(`DELETE FROM meeting_minute_task_category WHERE meeting_id = ?`)
          .bind(meetingId)
      );

      for (const categoryId of data.categoryIds) {
        statements.push(
          this.db
            .prepare(
              `INSERT INTO meeting_minute_task_category (meeting_id, category_id)
               VALUES (?, ?)`
            )
            .bind(meetingId, categoryId)
        );
      }
    }

    if (statements.length > 0) {
      await this.db.batch(statements);
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

  async findAll(query: ListMeetingMinutesQuery = {}): Promise<MeetingMinute[]> {
    let sql = `
      SELECT DISTINCT
        mm.meeting_id as meetingId,
        mm.meeting_date as meetingDate,
        mm.topic,
        mm.details_raw as detailsRaw,
        mm.keywords_json as keywordsJson,
        mm.created_at as createdAt,
        mm.updated_at as updatedAt
      FROM meeting_minutes mm
    `;
    const conditions: string[] = [];
    const params: string[] = [];

    if (query.categoryId) {
      sql += `
        INNER JOIN meeting_minute_task_category mmtc
          ON mm.meeting_id = mmtc.meeting_id
      `;
      conditions.push('mmtc.category_id = ?');
      params.push(query.categoryId);
    }

    if (query.attendeePersonId) {
      sql += `
        INNER JOIN meeting_minute_person mmp
          ON mm.meeting_id = mmp.meeting_id
      `;
      conditions.push('mmp.person_id = ?');
      params.push(query.attendeePersonId);
    }

    if (query.q) {
      conditions.push('(mm.topic LIKE ? OR mm.details_raw LIKE ? OR mm.keywords_text LIKE ?)');
      const qLike = `%${query.q}%`;
      params.push(qLike, qLike, qLike);
    }

    if (query.meetingDateFrom) {
      conditions.push('mm.meeting_date >= ?');
      params.push(query.meetingDateFrom);
    }

    if (query.meetingDateTo) {
      conditions.push('mm.meeting_date <= ?');
      params.push(query.meetingDateTo);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY mm.meeting_date DESC, mm.updated_at DESC`;

    const result = await this.db
      .prepare(sql)
      .bind(...params)
      .all<{
        meetingId: string;
        meetingDate: string;
        topic: string;
        detailsRaw: string;
        keywordsJson: string;
        createdAt: string;
        updatedAt: string;
      }>();

    return (result.results || []).map((row) => ({
      meetingId: row.meetingId,
      meetingDate: row.meetingDate,
      topic: row.topic,
      detailsRaw: row.detailsRaw,
      keywords: JSON.parse(row.keywordsJson || '[]'),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async delete(meetingId: string): Promise<void> {
    const existing = await this.db
      .prepare('SELECT 1 FROM meeting_minutes WHERE meeting_id = ?')
      .bind(meetingId)
      .first();

    if (!existing) {
      throw new NotFoundError('Meeting minute', meetingId);
    }

    await this.db.prepare('DELETE FROM meeting_minutes WHERE meeting_id = ?').bind(meetingId).run();
  }
}
