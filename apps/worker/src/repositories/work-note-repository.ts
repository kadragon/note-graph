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
import type { WorkNoteGroup } from '@shared/types/work-note-group';
import { nanoid } from 'nanoid';
import type {
  CreateWorkNoteInput,
  ListWorkNotesQuery,
  UpdateWorkNoteInput,
} from '../schemas/work-note';
import type { DatabaseClient } from '../types/database';
import { NotFoundError } from '../types/errors';
import { queryInChunks } from '../utils/db-utils';

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
      `SELECT work_id as workId, title, content_raw as contentRaw,
              category, created_at as createdAt,
              updated_at as updatedAt, embedded_at as embeddedAt
       FROM work_notes
       WHERE work_id = ?`,
      [workId]
    );
  }

  /**
   * Find work note by ID with all associations
   */
  async findByIdWithDetails(workId: string): Promise<WorkNoteDetail | null> {
    const workNote = await this.findById(workId);
    if (!workNote) {
      return null;
    }

    const [personsResult, relationsResult, categoriesResult, groupsResult, meetingsResult] =
      await Promise.all([
        this.db.query<WorkNotePersonAssociation>(
          `SELECT wnp.id, wnp.work_id as workId, wnp.person_id as personId,
                wnp.role, p.name as personName, p.current_dept as currentDept,
                p.current_position as currentPosition, p.phone_ext as phoneExt
         FROM work_note_person wnp
         INNER JOIN persons p ON wnp.person_id = p.person_id
         WHERE wnp.work_id = ?`,
          [workId]
        ),
        this.db.query<WorkNoteRelation>(
          `SELECT wnr.id, wnr.work_id as workId, wnr.related_work_id as relatedWorkId,
                wn.title as relatedWorkTitle
         FROM work_note_relation wnr
         LEFT JOIN work_notes wn ON wnr.related_work_id = wn.work_id
         WHERE wnr.work_id = ?`,
          [workId]
        ),
        this.db.query<TaskCategory>(
          `SELECT tc.category_id as categoryId, tc.name, tc.created_at as createdAt
         FROM task_categories tc
         INNER JOIN work_note_task_category wntc ON tc.category_id = wntc.category_id
         WHERE wntc.work_id = ?`,
          [workId]
        ),
        this.db.query<{ groupId: string; name: string; isActive: number; createdAt: string }>(
          `SELECT g.group_id as groupId, g.name, g.is_active as isActive, g.created_at as createdAt
         FROM work_note_groups g
         INNER JOIN work_note_group_items wngi ON g.group_id = wngi.group_id
         WHERE wngi.work_id = ?
         ORDER BY g.name ASC`,
          [workId]
        ),
        this.db.query<{
          meetingId: string;
          meetingDate: string;
          topic: string;
          keywordsJson: string;
        }>(
          `SELECT mm.meeting_id as meetingId, mm.meeting_date as meetingDate, mm.topic,
                mm.keywords_json as keywordsJson
         FROM work_note_meeting_minute wnmm
         INNER JOIN meeting_minutes mm ON mm.meeting_id = wnmm.meeting_id
         WHERE wnmm.work_id = ?
         ORDER BY mm.meeting_date DESC, mm.updated_at DESC, mm.meeting_id DESC`,
          [workId]
        ),
      ]);

    return {
      ...workNote,
      persons: personsResult.rows,
      relatedWorkNotes: relationsResult.rows,
      categories: categoriesResult.rows,
      groups: groupsResult.rows.map((g) => ({
        groupId: g.groupId,
        name: g.name,
        isActive: g.isActive === 1,
        createdAt: g.createdAt,
      })),
      relatedMeetingMinutes: meetingsResult.rows.map((meeting) => ({
        meetingId: meeting.meetingId,
        meetingDate: meeting.meetingDate,
        topic: meeting.topic,
        keywords: (() => {
          try {
            const parsed = JSON.parse(meeting.keywordsJson);
            return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
          } catch {
            return [];
          }
        })(),
      })),
    };
  }

  /**
   * Find multiple work notes by IDs (batch fetch)
   */
  async findByIds(workIds: string[]): Promise<WorkNote[]> {
    return queryInChunks(this.db, workIds, async (db, chunk, placeholders) => {
      const result = await db.query<WorkNote>(
        `SELECT work_id as workId, title, content_raw as contentRaw,
                category, created_at as createdAt,
                updated_at as updatedAt, embedded_at as embeddedAt
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
        `SELECT work_id as workId, title, description, status, due_date as dueDate
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
          `SELECT work_id as workId, title, content_raw as contentRaw,
                  category, created_at as createdAt,
                  updated_at as updatedAt, embedded_at as embeddedAt
           FROM work_notes
           WHERE work_id IN (${placeholders})`,
          chunk
        );
        return result.rows;
      }),
      queryInChunks(this.db, workIds, async (db, chunk, placeholders) => {
        const result = await db.query<WorkNotePersonAssociation & { workId: string }>(
          `SELECT wnp.id, wnp.work_id as workId, wnp.person_id as personId,
                  wnp.role, p.name as personName, p.current_dept as currentDept,
                  p.current_position as currentPosition, p.phone_ext as phoneExt
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
    let sql = `
      SELECT DISTINCT wn.work_id as workId, wn.title, wn.content_raw as contentRaw,
             wn.category, wn.created_at as createdAt,
             wn.updated_at as updatedAt, wn.embedded_at as embeddedAt
      FROM work_notes wn
    `;

    const conditions: string[] = [];
    const params: (string | null)[] = [];

    if (query.personId) {
      sql += ` INNER JOIN work_note_person wnp ON wn.work_id = wnp.work_id`;
      conditions.push(`wnp.person_id = ?`);
      params.push(query.personId);
    }

    if (query.deptName) {
      sql += `
        INNER JOIN work_note_person wnp2 ON wn.work_id = wnp2.work_id
        INNER JOIN person_dept_history pdh ON wnp2.person_id = pdh.person_id
      `;
      conditions.push(`pdh.dept_name = ?`);
      params.push(query.deptName);
    }

    if (query.category) {
      conditions.push(`wn.category = ?`);
      params.push(query.category);
    }

    if (query.q) {
      conditions.push(`(wn.title LIKE ? OR wn.content_raw LIKE ?)`);
      params.push(`%${query.q}%`, `%${query.q}%`);
    }

    if (query.from) {
      conditions.push(`wn.created_at >= ?`);
      params.push(query.from);
    }

    if (query.to) {
      conditions.push(`wn.created_at <= ?`);
      params.push(query.to);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY wn.created_at DESC`;

    const result = await this.db.query<WorkNote>(sql, params);
    const workNotes = result.rows;
    const workIds = workNotes.map((wn) => wn.workId);

    if (workIds.length === 0) {
      return [];
    }

    // Batch fetch categories, persons, and groups using json_each
    const workIdsJson = JSON.stringify(workIds);
    const [categoriesResult, personsResult, groupsResult] = await Promise.all([
      this.db.query<{
        workId: string;
        categoryId: string;
        name: string;
        isActive: number;
        createdAt: string;
      }>(
        `SELECT wntc.work_id as workId, tc.category_id as categoryId, tc.name, tc.is_active as isActive, tc.created_at as createdAt
         FROM task_categories tc
         INNER JOIN work_note_task_category wntc ON tc.category_id = wntc.category_id
         WHERE wntc.work_id IN (SELECT value FROM json_each(?))`,
        [workIdsJson]
      ),
      this.db.query<WorkNotePersonAssociation & { workId: string }>(
        `SELECT wnp.id, wnp.work_id as workId, wnp.person_id as personId,
                wnp.role, p.name as personName, p.current_dept as currentDept,
                p.current_position as currentPosition, p.phone_ext as phoneExt
         FROM work_note_person wnp
         INNER JOIN persons p ON wnp.person_id = p.person_id
         WHERE wnp.work_id IN (SELECT value FROM json_each(?))`,
        [workIdsJson]
      ),
      this.db.query<{
        workId: string;
        groupId: string;
        name: string;
        isActive: number;
        createdAt: string;
      }>(
        `SELECT wngi.work_id as workId, g.group_id as groupId, g.name, g.is_active as isActive, g.created_at as createdAt
         FROM work_note_groups g
         INNER JOIN work_note_group_items wngi ON g.group_id = wngi.group_id
         WHERE wngi.work_id IN (SELECT value FROM json_each(?))
         ORDER BY g.name ASC`,
        [workIdsJson]
      ),
    ]);

    const categoriesByWorkId = new Map<string, TaskCategory[]>();
    for (const cat of categoriesResult.rows) {
      if (!categoriesByWorkId.has(cat.workId)) {
        categoriesByWorkId.set(cat.workId, []);
      }
      categoriesByWorkId.get(cat.workId)?.push({
        categoryId: cat.categoryId,
        name: cat.name,
        isActive: cat.isActive === 1,
        createdAt: cat.createdAt,
      });
    }

    const personsByWorkId = new Map<string, WorkNotePersonAssociation[]>();
    for (const person of personsResult.rows) {
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

    const groupsByWorkId = new Map<string, WorkNoteGroup[]>();
    for (const group of groupsResult.rows) {
      if (!groupsByWorkId.has(group.workId)) {
        groupsByWorkId.set(group.workId, []);
      }
      groupsByWorkId.get(group.workId)?.push({
        groupId: group.groupId,
        name: group.name,
        isActive: group.isActive === 1,
        createdAt: group.createdAt,
      });
    }

    return workNotes.map((workNote) => ({
      ...workNote,
      persons: personsByWorkId.get(workNote.workId) || [],
      relatedWorkNotes: [],
      categories: categoriesByWorkId.get(workNote.workId) || [],
      groups: groupsByWorkId.get(workNote.workId) || [],
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
              VALUES (?, ?, ?, ?, ?, ?)`,
        params: [workId, data.title, data.contentRaw, data.category || null, now, now],
      },
      {
        sql: `INSERT INTO work_note_versions (work_id, version_no, title, content_raw, category, created_at)
              VALUES (?, 1, ?, ?, ?, ?)`,
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

      for (const person of data.persons) {
        const info = personInfoMap.get(person.personId);
        statements.push({
          sql: `INSERT INTO work_note_person (work_id, person_id, role, dept_at_time, position_at_time)
                VALUES (?, ?, ?, ?, ?)`,
          params: [
            workId,
            person.personId,
            person.role,
            info?.currentDept || null,
            info?.currentPosition || null,
          ],
        });
      }
    }

    if (data.relatedWorkIds && data.relatedWorkIds.length > 0) {
      for (const relatedWorkId of data.relatedWorkIds) {
        statements.push({
          sql: `INSERT INTO work_note_relation (work_id, related_work_id) VALUES (?, ?)`,
          params: [workId, relatedWorkId],
        });
      }
    }

    if (data.relatedMeetingIds && data.relatedMeetingIds.length > 0) {
      for (const meetingId of data.relatedMeetingIds) {
        statements.push({
          sql: `INSERT INTO work_note_meeting_minute (work_id, meeting_id) VALUES (?, ?)`,
          params: [workId, meetingId],
        });
      }
    }

    if (data.categoryIds && data.categoryIds.length > 0) {
      for (const categoryId of data.categoryIds) {
        statements.push({
          sql: `INSERT INTO work_note_task_category (work_id, category_id) VALUES (?, ?)`,
          params: [workId, categoryId],
        });
      }
    }

    if (data.groupIds && data.groupIds.length > 0) {
      for (const groupId of data.groupIds) {
        statements.push({
          sql: `INSERT OR IGNORE INTO work_note_group_items (work_id, group_id) VALUES (?, ?)`,
          params: [workId, groupId],
        });
      }
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

    if (data.title !== undefined) {
      updateFields.push('title = ?');
      updateParams.push(data.title);
    }
    if (data.contentRaw !== undefined) {
      updateFields.push('content_raw = ?');
      updateParams.push(data.contentRaw);
    }
    if (data.category !== undefined) {
      updateFields.push('category = ?');
      updateParams.push(data.category || null);
    }
    if (updateFields.length > 0) {
      updateFields.push('updated_at = ?');
      updateFields.push('embedded_at = NULL');
      updateParams.push(now);
      updateParams.push(workId);

      statements.push({
        sql: `UPDATE work_notes SET ${updateFields.join(', ')} WHERE work_id = ?`,
        params: updateParams,
      });

      // Get next version number
      const versionCountResult = await this.db.queryOne<{ nextVersion: number }>(
        `SELECT COALESCE(MAX(version_no), 0) + 1 as nextVersion FROM work_note_versions WHERE work_id = ?`,
        [workId]
      );

      const nextVersionNo = versionCountResult?.nextVersion || 1;

      statements.push({
        sql: `INSERT INTO work_note_versions (work_id, version_no, title, content_raw, category, created_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
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
              WHERE work_id = ?
                AND id NOT IN (
                  SELECT id FROM work_note_versions
                  WHERE work_id = ?
                  ORDER BY version_no DESC
                  LIMIT ?
                )`,
        params: [workId, workId, MAX_VERSIONS],
      });
    }

    // Update person associations if provided
    if (data.persons !== undefined) {
      statements.push({
        sql: `DELETE FROM work_note_person WHERE work_id = ?`,
        params: [workId],
      });

      if (data.persons.length > 0) {
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

        for (const person of data.persons) {
          const info = personInfoMap.get(person.personId);
          statements.push({
            sql: `INSERT INTO work_note_person (work_id, person_id, role, dept_at_time, position_at_time)
                  VALUES (?, ?, ?, ?, ?)`,
            params: [
              workId,
              person.personId,
              person.role,
              info?.currentDept || null,
              info?.currentPosition || null,
            ],
          });
        }
      }
    }

    if (data.relatedWorkIds !== undefined) {
      statements.push({
        sql: `DELETE FROM work_note_relation WHERE work_id = ?`,
        params: [workId],
      });
      for (const relatedWorkId of data.relatedWorkIds) {
        statements.push({
          sql: `INSERT INTO work_note_relation (work_id, related_work_id) VALUES (?, ?)`,
          params: [workId, relatedWorkId],
        });
      }
    }

    if (data.relatedMeetingIds !== undefined) {
      statements.push({
        sql: `DELETE FROM work_note_meeting_minute WHERE work_id = ?`,
        params: [workId],
      });
      for (const meetingId of data.relatedMeetingIds) {
        statements.push({
          sql: `INSERT INTO work_note_meeting_minute (work_id, meeting_id) VALUES (?, ?)`,
          params: [workId, meetingId],
        });
      }
    }

    if (data.categoryIds !== undefined) {
      statements.push({
        sql: `DELETE FROM work_note_task_category WHERE work_id = ?`,
        params: [workId],
      });
      for (const categoryId of data.categoryIds) {
        statements.push({
          sql: `INSERT INTO work_note_task_category (work_id, category_id) VALUES (?, ?)`,
          params: [workId, categoryId],
        });
      }
    }

    if (data.groupIds !== undefined) {
      statements.push({
        sql: `DELETE FROM work_note_group_items WHERE work_id = ?`,
        params: [workId],
      });
      for (const groupId of data.groupIds) {
        statements.push({
          sql: `INSERT OR IGNORE INTO work_note_group_items (work_id, group_id) VALUES (?, ?)`,
          params: [workId, groupId],
        });
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

    await this.db.execute(`DELETE FROM work_notes WHERE work_id = ?`, [workId]);
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
      `SELECT id, work_id as workId, version_no as versionNo,
              title, content_raw as contentRaw, category, created_at as createdAt
       FROM work_note_versions
       WHERE work_id = ?
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
      'SELECT current_dept FROM persons WHERE person_id = ?',
      [personId]
    );

    return result?.current_dept || null;
  }

  /**
   * Update embedded_at timestamp for a work note
   */
  async updateEmbeddedAt(workId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.execute('UPDATE work_notes SET embedded_at = ? WHERE work_id = ?', [now, workId]);
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
       SET embedded_at = ?
       WHERE work_id = ? AND updated_at = ?`,
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
      `SELECT work_id as workId, title, content_raw as contentRaw,
              category, created_at as createdAt, updated_at as updatedAt,
              embedded_at as embeddedAt
       FROM work_notes
       WHERE embedded_at IS NULL
       ORDER BY created_at ASC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return result.rows;
  }
}
