// Trace: SPEC-worknote-1, TASK-007, TASK-003, TASK-041
/**
 * Work note repository for database operations
 */

import type { ReferenceTodo } from '@shared/types/search';
import type { TaskCategory } from '@shared/types/task-category';
import type {
  WorkNote,
  WorkNoteDetail,
  WorkNotePersonAssociation,
  WorkNoteRelation,
  WorkNoteVersion,
} from '@shared/types/work-note';
import { nanoid } from 'nanoid';
import type {
  CreateWorkNoteInput,
  ListWorkNotesQuery,
  UpdateWorkNoteInput,
} from '../schemas/work-note';
import type { DatabaseClient } from '../types/database';
import { NotFoundError } from '../types/errors';
import { buildMultiRowInsert, queryInChunks } from '../utils/db-utils';
import { parseKeywordsJson } from '../utils/json-utils';

const MAX_VERSIONS = 5;

export class WorkNoteRepository {
  constructor(private db: DatabaseClient) {}

  /**
   * Generate work_id in format WORK-{ulid}
   */
  private generateWorkId(): string {
    return `WORK-${nanoid()}`;
  }

  /**
   * Find work note by ID
   */
  async findById(workId: string): Promise<WorkNote | null> {
    return this.db.queryOne<WorkNote>(
      `SELECT work_id as "workId", title, content_raw as "contentRaw",
              category, created_at as "createdAt",
              updated_at as "updatedAt", embedded_at as "embeddedAt"
       FROM work_notes
       WHERE work_id = $1`,
      [workId]
    );
  }

  /**
   * Find work note by ID with all associations
   */
  async findByIdWithDetails(workId: string): Promise<WorkNoteDetail | null> {
    const row = await this.db.queryOne<{
      workId: string;
      title: string;
      contentRaw: string;
      category: string | null;
      createdAt: string;
      updatedAt: string;
      embeddedAt: string | null;
      persons: WorkNotePersonAssociation[] | null;
      relatedWorkNotes: WorkNoteRelation[] | null;
      categories: TaskCategory[] | null;
      groups: Array<{ groupId: string; name: string; isActive: boolean; createdAt: string }> | null;
      relatedMeetingMinutes: Array<{
        meetingId: string;
        meetingDate: string;
        topic: string;
        keywordsJson: string;
      }> | null;
    }>(
      `SELECT
        wn.work_id as "workId", wn.title, wn.content_raw as "contentRaw",
        wn.category, wn.created_at as "createdAt",
        wn.updated_at as "updatedAt", wn.embedded_at as "embeddedAt",
        COALESCE(pers.data, '[]') as "persons",
        COALESCE(rels.data, '[]') as "relatedWorkNotes",
        COALESCE(cats.data, '[]') as "categories",
        COALESCE(grps.data, '[]') as "groups",
        COALESCE(meets.data, '[]') as "relatedMeetingMinutes"
      FROM work_notes wn
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'id', wnp.id, 'workId', wnp.work_id, 'personId', wnp.person_id,
          'role', wnp.role, 'personName', p.name, 'currentDept', p.current_dept,
          'currentPosition', p.current_position, 'phoneExt', p.phone_ext
        )) as data
        FROM work_note_person wnp
        JOIN persons p ON wnp.person_id = p.person_id
        WHERE wnp.work_id = wn.work_id
      ) pers ON true
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'id', wnr.id, 'workId', wnr.work_id,
          'relatedWorkId', wnr.related_work_id,
          'relatedWorkTitle', rw.title
        )) as data
        FROM work_note_relation wnr
        LEFT JOIN work_notes rw ON wnr.related_work_id = rw.work_id
        WHERE wnr.work_id = wn.work_id
      ) rels ON true
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'categoryId', tc.category_id, 'name', tc.name, 'createdAt', tc.created_at
        )) as data
        FROM task_categories tc
        JOIN work_note_task_category wntc ON tc.category_id = wntc.category_id
        WHERE wntc.work_id = wn.work_id
      ) cats ON true
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'groupId', g.group_id, 'name', g.name,
          'isActive', g.is_active, 'createdAt', g.created_at
        ) ORDER BY g.name ASC) as data
        FROM work_note_groups g
        JOIN work_note_group_items wngi ON g.group_id = wngi.group_id
        WHERE wngi.work_id = wn.work_id
      ) grps ON true
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'meetingId', mm.meeting_id, 'meetingDate', mm.meeting_date,
          'topic', mm.topic, 'keywordsJson', mm.keywords_json
        ) ORDER BY mm.meeting_date DESC, mm.updated_at DESC, mm.meeting_id DESC) as data
        FROM work_note_meeting_minute wnmm
        JOIN meeting_minutes mm ON mm.meeting_id = wnmm.meeting_id
        WHERE wnmm.work_id = wn.work_id
      ) meets ON true
      WHERE wn.work_id = $1`,
      [workId]
    );

    if (!row) {
      return null;
    }

    return {
      workId: row.workId,
      title: row.title,
      contentRaw: row.contentRaw,
      category: row.category,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      embeddedAt: row.embeddedAt,
      persons: row.persons || [],
      relatedWorkNotes: row.relatedWorkNotes || [],
      categories: row.categories || [],
      groups: (row.groups || []).map((g) => ({
        groupId: g.groupId,
        name: g.name,
        isActive: Boolean(g.isActive),
        createdAt: g.createdAt,
      })),
      relatedMeetingMinutes: (row.relatedMeetingMinutes || []).map((meeting) => ({
        meetingId: meeting.meetingId,
        meetingDate: meeting.meetingDate,
        topic: meeting.topic,
        keywords: parseKeywordsJson(meeting.keywordsJson),
      })),
    };
  }

  /**
   * Find multiple work notes by IDs (batch fetch)
   */
  async findByIds(workIds: string[]): Promise<WorkNote[]> {
    return queryInChunks(this.db, workIds, async (db, chunk, placeholders) => {
      const result = await db.query<WorkNote>(
        `SELECT work_id as "workId", title, content_raw as "contentRaw",
                category, created_at as "createdAt",
                updated_at as "updatedAt", embedded_at as "embeddedAt"
         FROM work_notes
         WHERE work_id IN (${placeholders})`,
        chunk
      );
      return result.rows;
    });
  }

  /**
   * Find todos for multiple work notes by IDs (batch fetch)
   */
  async findTodosByWorkIds(workIds: string[]): Promise<Map<string, ReferenceTodo[]>> {
    const todos = await queryInChunks(this.db, workIds, async (db, chunk, placeholders) => {
      const result = await db.query<{
        workId: string;
        title: string;
        description: string | null;
        status: string;
        dueDate: string | null;
      }>(
        `SELECT work_id as "workId", title, description, status, due_date as "dueDate"
         FROM todos
         WHERE work_id IN (${placeholders})
         ORDER BY due_date ASC NULLS LAST, created_at ASC`,
        chunk
      );
      return result.rows;
    });

    const todosByWorkId = new Map<string, ReferenceTodo[]>();
    for (const todo of todos) {
      if (!todosByWorkId.has(todo.workId)) {
        todosByWorkId.set(todo.workId, []);
      }
      todosByWorkId.get(todo.workId)?.push({
        title: todo.title,
        description: todo.description,
        status: todo.status,
        dueDate: todo.dueDate,
      });
    }
    return todosByWorkId;
  }

  /**
   * Find multiple work notes by IDs with all associations (batch fetch)
   */
  async findByIdsWithDetails(workIds: string[]): Promise<Map<string, WorkNoteDetail>> {
    if (workIds.length === 0) return new Map();

    const [workNotes, persons] = await Promise.all([
      queryInChunks(this.db, workIds, async (db, chunk, placeholders) => {
        const result = await db.query<WorkNote>(
          `SELECT work_id as "workId", title, content_raw as "contentRaw",
                  category, created_at as "createdAt",
                  updated_at as "updatedAt", embedded_at as "embeddedAt"
           FROM work_notes
           WHERE work_id IN (${placeholders})`,
          chunk
        );
        return result.rows;
      }),
      queryInChunks(this.db, workIds, async (db, chunk, placeholders) => {
        const result = await db.query<WorkNotePersonAssociation & { workId: string }>(
          `SELECT wnp.id, wnp.work_id as "workId", wnp.person_id as "personId",
                  wnp.role, p.name as "personName", p.current_dept as "currentDept",
                  p.current_position as "currentPosition", p.phone_ext as "phoneExt"
           FROM work_note_person wnp
           INNER JOIN persons p ON wnp.person_id = p.person_id
           WHERE wnp.work_id IN (${placeholders})`,
          chunk
        );
        return result.rows;
      }),
    ]);

    const personsByWorkId = new Map<string, WorkNotePersonAssociation[]>();
    for (const person of persons) {
      if (!personsByWorkId.has(person.workId)) {
        personsByWorkId.set(person.workId, []);
      }
      personsByWorkId.get(person.workId)?.push({
        id: person.id,
        workId: person.workId,
        personId: person.personId,
        role: person.role,
        personName: person.personName,
        currentDept: person.currentDept,
        currentPosition: person.currentPosition,
        phoneExt: person.phoneExt,
      });
    }

    const result = new Map<string, WorkNoteDetail>();
    for (const workNote of workNotes) {
      result.set(workNote.workId, {
        ...workNote,
        persons: personsByWorkId.get(workNote.workId) || [],
        relatedWorkNotes: [],
        categories: [],
        groups: [],
      });
    }
    return result;
  }

  /**
   * Find all work notes with filters
   */
  async findAll(query: ListWorkNotesQuery): Promise<WorkNoteDetail[]> {
    let filterJoins = '';
    const conditions: string[] = [];
    const params: (string | null)[] = [];
    let paramIndex = 1;

    if (query.personId) {
      filterJoins += ` INNER JOIN work_note_person wnp ON wn.work_id = wnp.work_id`;
      conditions.push(`wnp.person_id = $${paramIndex++}`);
      params.push(query.personId);
    }

    if (query.deptName) {
      filterJoins += `
        INNER JOIN work_note_person wnp2 ON wn.work_id = wnp2.work_id
        INNER JOIN person_dept_history pdh ON wnp2.person_id = pdh.person_id
      `;
      conditions.push(`pdh.dept_name = $${paramIndex++}`);
      params.push(query.deptName);
    }

    if (query.category) {
      conditions.push(`wn.category = $${paramIndex++}`);
      params.push(query.category);
    }

    if (query.q) {
      conditions.push(`(wn.title LIKE $${paramIndex++} OR wn.content_raw LIKE $${paramIndex++})`);
      params.push(`%${query.q}%`, `%${query.q}%`);
    }

    if (query.from) {
      conditions.push(`wn.created_at >= $${paramIndex++}`);
      params.push(query.from);
    }

    if (query.to) {
      conditions.push(`wn.created_at <= $${paramIndex++}`);
      params.push(query.to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT
        wn.work_id as "workId", wn.title, wn.content_raw as "contentRaw",
        wn.category, wn.created_at as "createdAt",
        wn.updated_at as "updatedAt", wn.embedded_at as "embeddedAt",
        COALESCE(pers.data, '[]') as "persons",
        COALESCE(cats.data, '[]') as "categories",
        COALESCE(grps.data, '[]') as "groups"
      FROM (
        SELECT DISTINCT wn.work_id
        FROM work_notes wn
        ${filterJoins}
        ${whereClause}
      ) filtered
      INNER JOIN work_notes wn ON wn.work_id = filtered.work_id
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'id', wnp.id, 'workId', wnp.work_id, 'personId', wnp.person_id,
          'role', wnp.role, 'personName', p.name, 'currentDept', p.current_dept,
          'currentPosition', p.current_position, 'phoneExt', p.phone_ext
        )) as data
        FROM work_note_person wnp
        JOIN persons p ON wnp.person_id = p.person_id
        WHERE wnp.work_id = wn.work_id
      ) pers ON true
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'categoryId', tc.category_id, 'name', tc.name,
          'isActive', tc.is_active, 'createdAt', tc.created_at
        )) as data
        FROM task_categories tc
        JOIN work_note_task_category wntc ON tc.category_id = wntc.category_id
        WHERE wntc.work_id = wn.work_id
      ) cats ON true
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'groupId', g.group_id, 'name', g.name,
          'isActive', g.is_active, 'createdAt', g.created_at
        ) ORDER BY g.name ASC) as data
        FROM work_note_groups g
        JOIN work_note_group_items wngi ON g.group_id = wngi.group_id
        WHERE wngi.work_id = wn.work_id
      ) grps ON true
      ORDER BY wn.created_at DESC
    `;

    const result = await this.db.query<{
      workId: string;
      title: string;
      contentRaw: string;
      category: string | null;
      createdAt: string;
      updatedAt: string;
      embeddedAt: string | null;
      persons: WorkNotePersonAssociation[] | null;
      categories: Array<{
        categoryId: string;
        name: string;
        isActive: boolean;
        createdAt: string;
      }> | null;
      groups: Array<{ groupId: string; name: string; isActive: boolean; createdAt: string }> | null;
    }>(sql, params);

    return result.rows.map((row) => ({
      workId: row.workId,
      title: row.title,
      contentRaw: row.contentRaw,
      category: row.category,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      embeddedAt: row.embeddedAt,
      persons: row.persons || [],
      relatedWorkNotes: [],
      categories: (row.categories || []).map((c) => ({
        categoryId: c.categoryId,
        name: c.name,
        isActive: Boolean(c.isActive),
        createdAt: c.createdAt,
      })),
      groups: (row.groups || []).map((g) => ({
        groupId: g.groupId,
        name: g.name,
        isActive: Boolean(g.isActive),
        createdAt: g.createdAt,
      })),
    }));
  }

  /**
   * Create new work note with person associations and first version
   */
  async create(data: CreateWorkNoteInput): Promise<WorkNote> {
    const now = new Date().toISOString();
    const workId = this.generateWorkId();

    const statements: Array<{ sql: string; params?: unknown[] }> = [
      {
        sql: `INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6)`,
        params: [workId, data.title, data.contentRaw, data.category || null, now, now],
      },
      {
        sql: `INSERT INTO work_note_versions (work_id, version_no, title, content_raw, category, created_at)
              VALUES ($1, 1, $2, $3, $4, $5)`,
        params: [workId, data.title, data.contentRaw, data.category || null, now],
      },
    ];

    // Add person associations with snapshot of current department and position
    if (data.persons && data.persons.length > 0) {
      const personIds = data.persons.map((p) => p.personId);
      const personsInfo = await queryInChunks(
        this.db,
        personIds,
        async (db, chunk, placeholders) => {
          const result = await db.query<{
            person_id: string;
            current_dept: string | null;
            current_position: string | null;
          }>(
            `SELECT person_id, current_dept, current_position FROM persons WHERE person_id IN (${placeholders})`,
            chunk
          );
          return result.rows;
        }
      );

      const personInfoMap = new Map<
        string,
        { currentDept: string | null; currentPosition: string | null }
      >();
      for (const info of personsInfo) {
        personInfoMap.set(info.person_id, {
          currentDept: info.current_dept,
          currentPosition: info.current_position,
        });
      }

      const personRows = data.persons.map((person) => {
        const info = personInfoMap.get(person.personId);
        return [
          workId,
          person.personId,
          person.role,
          info?.currentDept || null,
          info?.currentPosition || null,
        ];
      });
      statements.push(
        buildMultiRowInsert(
          'work_note_person',
          ['work_id', 'person_id', 'role', 'dept_at_time', 'position_at_time'],
          personRows
        )
      );
    }

    if (data.relatedWorkIds && data.relatedWorkIds.length > 0) {
      statements.push(
        buildMultiRowInsert(
          'work_note_relation',
          ['work_id', 'related_work_id'],
          data.relatedWorkIds.map((id) => [workId, id])
        )
      );
    }

    if (data.relatedMeetingIds && data.relatedMeetingIds.length > 0) {
      statements.push(
        buildMultiRowInsert(
          'work_note_meeting_minute',
          ['work_id', 'meeting_id'],
          data.relatedMeetingIds.map((id) => [workId, id])
        )
      );
    }

    if (data.categoryIds && data.categoryIds.length > 0) {
      statements.push(
        buildMultiRowInsert(
          'work_note_task_category',
          ['work_id', 'category_id'],
          data.categoryIds.map((id) => [workId, id])
        )
      );
    }

    if (data.groupIds && data.groupIds.length > 0) {
      statements.push(
        buildMultiRowInsert(
          'work_note_group_items',
          ['work_id', 'group_id'],
          data.groupIds.map((id) => [workId, id]),
          'ON CONFLICT DO NOTHING'
        )
      );
    }

    await this.db.executeBatch(statements);

    return {
      workId,
      title: data.title,
      contentRaw: data.contentRaw,
      category: data.category || null,
      createdAt: now,
      updatedAt: now,
      embeddedAt: null,
    };
  }

  /**
   * Update work note and create new version with automatic pruning
   */
  async update(workId: string, data: UpdateWorkNoteInput): Promise<WorkNote> {
    const existing = await this.findById(workId);
    if (!existing) {
      throw new NotFoundError('Work note', workId);
    }

    const now = new Date().toISOString();
    const statements: Array<{ sql: string; params?: unknown[] }> = [];

    // Build update fields for work note
    const updateFields: string[] = [];
    const updateParams: (string | null)[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      updateFields.push(`title = $${paramIndex++}`);
      updateParams.push(data.title);
    }
    if (data.contentRaw !== undefined) {
      updateFields.push(`content_raw = $${paramIndex++}`);
      updateParams.push(data.contentRaw);
    }
    if (data.category !== undefined) {
      updateFields.push(`category = $${paramIndex++}`);
      updateParams.push(data.category || null);
    }
    if (updateFields.length > 0) {
      updateFields.push(`updated_at = $${paramIndex++}`);
      updateFields.push('embedded_at = NULL');
      updateParams.push(now);
      updateParams.push(workId);

      statements.push({
        sql: `UPDATE work_notes SET ${updateFields.join(', ')} WHERE work_id = $${paramIndex}`,
        params: updateParams,
      });

      // Get next version number
      const versionCountResult = await this.db.queryOne<{ nextVersion: number }>(
        `SELECT COALESCE(MAX(version_no), 0) + 1 as "nextVersion" FROM work_note_versions WHERE work_id = $1`,
        [workId]
      );

      const nextVersionNo = versionCountResult?.nextVersion || 1;

      statements.push({
        sql: `INSERT INTO work_note_versions (work_id, version_no, title, content_raw, category, created_at)
              VALUES ($1, $2, $3, $4, $5, $6)`,
        params: [
          workId,
          nextVersionNo,
          data.title || existing.title,
          data.contentRaw || existing.contentRaw,
          data.category !== undefined ? data.category || null : existing.category,
          now,
        ],
      });

      // Prune old versions (keep max 5)
      statements.push({
        sql: `DELETE FROM work_note_versions
              WHERE work_id = $1
                AND id NOT IN (
                  SELECT id FROM work_note_versions
                  WHERE work_id = $2
                  ORDER BY version_no DESC
                  LIMIT $3
                )`,
        params: [workId, workId, MAX_VERSIONS],
      });
    }

    // Update person associations if provided (UPSERT pattern)
    if (data.persons !== undefined) {
      if (data.persons.length === 0) {
        statements.push({
          sql: `DELETE FROM work_note_person WHERE work_id = $1`,
          params: [workId],
        });
      } else {
        const personIds = data.persons.map((p) => p.personId);
        const personsInfo = await queryInChunks(
          this.db,
          personIds,
          async (db, chunk, placeholders) => {
            const result = await db.query<{
              person_id: string;
              current_dept: string | null;
              current_position: string | null;
            }>(
              `SELECT person_id, current_dept, current_position FROM persons WHERE person_id IN (${placeholders})`,
              chunk
            );
            return result.rows;
          }
        );

        const personInfoMap = new Map<
          string,
          { currentDept: string | null; currentPosition: string | null }
        >();
        for (const info of personsInfo) {
          personInfoMap.set(info.person_id, {
            currentDept: info.current_dept,
            currentPosition: info.current_position,
          });
        }

        // Delete removed persons
        const inPlaceholders = personIds.map((_, i) => `$${i + 2}`).join(', ');
        statements.push({
          sql: `DELETE FROM work_note_person WHERE work_id = $1 AND person_id NOT IN (${inPlaceholders})`,
          params: [workId, ...personIds],
        });

        // Upsert remaining
        const personRows = data.persons.map((person) => {
          const info = personInfoMap.get(person.personId);
          return [
            workId,
            person.personId,
            person.role,
            info?.currentDept || null,
            info?.currentPosition || null,
          ];
        });
        statements.push(
          buildMultiRowInsert(
            'work_note_person',
            ['work_id', 'person_id', 'role', 'dept_at_time', 'position_at_time'],
            personRows,
            'ON CONFLICT (work_id, person_id) DO UPDATE SET role = EXCLUDED.role, dept_at_time = EXCLUDED.dept_at_time, position_at_time = EXCLUDED.position_at_time'
          )
        );
      }
    }

    if (data.relatedWorkIds !== undefined) {
      if (data.relatedWorkIds.length === 0) {
        statements.push({
          sql: `DELETE FROM work_note_relation WHERE work_id = $1`,
          params: [workId],
        });
      } else {
        const inPlaceholders = data.relatedWorkIds.map((_, i) => `$${i + 2}`).join(', ');
        statements.push({
          sql: `DELETE FROM work_note_relation WHERE work_id = $1 AND related_work_id NOT IN (${inPlaceholders})`,
          params: [workId, ...data.relatedWorkIds],
        });
        statements.push(
          buildMultiRowInsert(
            'work_note_relation',
            ['work_id', 'related_work_id'],
            data.relatedWorkIds.map((id) => [workId, id]),
            'ON CONFLICT (work_id, related_work_id) DO NOTHING'
          )
        );
      }
    }

    if (data.relatedMeetingIds !== undefined) {
      if (data.relatedMeetingIds.length === 0) {
        statements.push({
          sql: `DELETE FROM work_note_meeting_minute WHERE work_id = $1`,
          params: [workId],
        });
      } else {
        const inPlaceholders = data.relatedMeetingIds.map((_, i) => `$${i + 2}`).join(', ');
        statements.push({
          sql: `DELETE FROM work_note_meeting_minute WHERE work_id = $1 AND meeting_id NOT IN (${inPlaceholders})`,
          params: [workId, ...data.relatedMeetingIds],
        });
        statements.push(
          buildMultiRowInsert(
            'work_note_meeting_minute',
            ['work_id', 'meeting_id'],
            data.relatedMeetingIds.map((id) => [workId, id]),
            'ON CONFLICT (work_id, meeting_id) DO NOTHING'
          )
        );
      }
    }

    if (data.categoryIds !== undefined) {
      if (data.categoryIds.length === 0) {
        statements.push({
          sql: `DELETE FROM work_note_task_category WHERE work_id = $1`,
          params: [workId],
        });
      } else {
        const inPlaceholders = data.categoryIds.map((_, i) => `$${i + 2}`).join(', ');
        statements.push({
          sql: `DELETE FROM work_note_task_category WHERE work_id = $1 AND category_id NOT IN (${inPlaceholders})`,
          params: [workId, ...data.categoryIds],
        });
        statements.push(
          buildMultiRowInsert(
            'work_note_task_category',
            ['work_id', 'category_id'],
            data.categoryIds.map((id) => [workId, id]),
            'ON CONFLICT (work_id, category_id) DO NOTHING'
          )
        );
      }
    }

    if (data.groupIds !== undefined) {
      if (data.groupIds.length === 0) {
        statements.push({
          sql: `DELETE FROM work_note_group_items WHERE work_id = $1`,
          params: [workId],
        });
      } else {
        const inPlaceholders = data.groupIds.map((_, i) => `$${i + 2}`).join(', ');
        statements.push({
          sql: `DELETE FROM work_note_group_items WHERE work_id = $1 AND group_id NOT IN (${inPlaceholders})`,
          params: [workId, ...data.groupIds],
        });
        statements.push(
          buildMultiRowInsert(
            'work_note_group_items',
            ['work_id', 'group_id'],
            data.groupIds.map((id) => [workId, id]),
            'ON CONFLICT (work_id, group_id) DO NOTHING'
          )
        );
      }
    }

    await this.db.executeBatch(statements);

    return {
      ...existing,
      title: data.title !== undefined ? data.title : existing.title,
      contentRaw: data.contentRaw !== undefined ? data.contentRaw : existing.contentRaw,
      category: data.category !== undefined ? data.category || null : existing.category,
      updatedAt: updateFields.length > 0 ? now : existing.updatedAt,
      embeddedAt: updateFields.length > 0 ? null : existing.embeddedAt,
    };
  }

  /**
   * Delete work note (cascade deletes handled by database)
   */
  async delete(workId: string): Promise<void> {
    const existing = await this.findById(workId);
    if (!existing) {
      throw new NotFoundError('Work note', workId);
    }

    await this.db.execute(`DELETE FROM work_notes WHERE work_id = $1`, [workId]);
  }

  /**
   * Get versions for a work note
   */
  async getVersions(workId: string): Promise<WorkNoteVersion[]> {
    const workNote = await this.findById(workId);
    if (!workNote) {
      throw new NotFoundError('Work note', workId);
    }

    const result = await this.db.query<WorkNoteVersion>(
      `SELECT id, work_id as "workId", version_no as "versionNo",
              title, content_raw as "contentRaw", category, created_at as "createdAt"
       FROM work_note_versions
       WHERE work_id = $1
       ORDER BY version_no DESC`,
      [workId]
    );

    return result.rows;
  }

  /**
   * Get department name for a person
   */
  async getDeptNameForPerson(personId: string): Promise<string | null> {
    const result = await this.db.queryOne<{ current_dept: string | null }>(
      'SELECT current_dept FROM persons WHERE person_id = $1',
      [personId]
    );

    return result?.current_dept || null;
  }

  /**
   * Update embedded_at timestamp for a work note
   */
  async updateEmbeddedAt(workId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.execute('UPDATE work_notes SET embedded_at = $1 WHERE work_id = $2', [
      now,
      workId,
    ]);
  }

  /**
   * Update embedded_at only when updated_at matches the expected value.
   */
  async updateEmbeddedAtIfUpdatedAtMatches(
    workId: string,
    expectedUpdatedAt: string
  ): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.db.execute(
      `UPDATE work_notes
       SET embedded_at = $1
       WHERE work_id = $2 AND updated_at = $3`,
      [now, workId, expectedUpdatedAt]
    );

    return result.rowCount > 0;
  }

  /**
   * Get count of embedded and non-embedded work notes
   */
  async getEmbeddingStats(): Promise<{ total: number; embedded: number; pending: number }> {
    const result = await this.db.queryOne<{ total: number; embedded: number; pending: number }>(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN embedded_at IS NOT NULL THEN 1 ELSE 0 END) as embedded,
         SUM(CASE WHEN embedded_at IS NULL THEN 1 ELSE 0 END) as pending
       FROM work_notes`
    );

    return {
      total: result?.total || 0,
      embedded: result?.embedded || 0,
      pending: result?.pending || 0,
    };
  }

  /**
   * Find work notes that are not yet embedded
   */
  async findPendingEmbedding(limit: number = 10, offset: number = 0): Promise<WorkNote[]> {
    const result = await this.db.query<WorkNote>(
      `SELECT work_id as "workId", title, content_raw as "contentRaw",
              category, created_at as "createdAt", updated_at as "updatedAt",
              embedded_at as "embeddedAt"
       FROM work_notes
       WHERE embedded_at IS NULL
       ORDER BY created_at ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return result.rows;
  }
}
