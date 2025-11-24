// Trace: SPEC-worknote-1, TASK-007, TASK-003
/**
 * Work note repository for D1 database operations
 */

import type { D1Database } from '@cloudflare/workers-types';
import { nanoid } from 'nanoid';
import type { WorkNote, WorkNoteDetail, WorkNoteVersion, WorkNotePersonAssociation, WorkNoteRelation } from '../types/work-note';
import type { CreateWorkNoteInput, UpdateWorkNoteInput, ListWorkNotesQuery } from '../schemas/work-note';
import type { TaskCategory } from '../types/task-category';
import type { ReferenceTodo } from '../types/search';
import { NotFoundError } from '../types/errors';

const MAX_VERSIONS = 5;

export class WorkNoteRepository {
  constructor(private db: D1Database) {}

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
    const result = await this.db
      .prepare(
        `SELECT work_id as workId, title, content_raw as contentRaw,
                category, created_at as createdAt, updated_at as updatedAt,
                embedded_at as embeddedAt
         FROM work_notes
         WHERE work_id = ?`
      )
      .bind(workId)
      .first<WorkNote>();

    return result || null;
  }

  /**
   * Find work note by ID with all associations
   */
  async findByIdWithDetails(workId: string): Promise<WorkNoteDetail | null> {
    const workNote = await this.findById(workId);
    if (!workNote) {
      return null;
    }

    // Get associated persons, related work notes, and categories in parallel
    const [personsResult, relationsResult, categoriesResult] = await Promise.all([
      this.db
        .prepare(
          `SELECT wnp.id, wnp.work_id as workId, wnp.person_id as personId,
                  wnp.role, p.name as personName, p.current_dept as currentDept,
                  p.current_position as currentPosition
           FROM work_note_person wnp
           INNER JOIN persons p ON wnp.person_id = p.person_id
           WHERE wnp.work_id = ?`
        )
        .bind(workId)
        .all<WorkNotePersonAssociation>(),
      this.db
        .prepare(
          `SELECT wnr.id, wnr.work_id as workId, wnr.related_work_id as relatedWorkId,
                  wn.title as relatedWorkTitle
           FROM work_note_relation wnr
           LEFT JOIN work_notes wn ON wnr.related_work_id = wn.work_id
           WHERE wnr.work_id = ?`
        )
        .bind(workId)
        .all<WorkNoteRelation>(),
      this.db
        .prepare(
          `SELECT tc.category_id as categoryId, tc.name, tc.created_at as createdAt
           FROM task_categories tc
           INNER JOIN work_note_task_category wntc ON tc.category_id = wntc.category_id
           WHERE wntc.work_id = ?`
        )
        .bind(workId)
        .all<TaskCategory>(),
    ]);

    return {
      ...workNote,
      persons: personsResult.results || [],
      relatedWorkNotes: relationsResult.results || [],
      categories: categoriesResult.results || [],
    };
  }

  /**
   * Find multiple work notes by IDs (batch fetch)
   */
  async findByIds(workIds: string[]): Promise<WorkNote[]> {
    if (workIds.length === 0) {
      return [];
    }

    const placeholders = workIds.map(() => '?').join(',');
    const result = await this.db
      .prepare(
        `SELECT work_id as workId, title, content_raw as contentRaw,
                category, created_at as createdAt, updated_at as updatedAt,
                embedded_at as embeddedAt
         FROM work_notes
         WHERE work_id IN (${placeholders})`
      )
      .bind(...workIds)
      .all<WorkNote>();

    return result.results || [];
  }

  /**
   * Find todos for multiple work notes by IDs (batch fetch)
   * Returns a map of workId to array of simplified todos for AI reference context
   */
  async findTodosByWorkIds(workIds: string[]): Promise<Map<string, ReferenceTodo[]>> {
    if (workIds.length === 0) {
      return new Map();
    }

    const placeholders = workIds.map(() => '?').join(',');
    const result = await this.db
      .prepare(
        `SELECT work_id as workId, title, description, status, due_date as dueDate
         FROM todos
         WHERE work_id IN (${placeholders})
         ORDER BY due_date ASC NULLS LAST, created_at ASC`
      )
      .bind(...workIds)
      .all<{ workId: string; title: string; description: string | null; status: string; dueDate: string | null }>();

    // Group todos by workId
    const todosByWorkId = new Map<string, ReferenceTodo[]>();
    for (const todo of result.results || []) {
      if (!todosByWorkId.has(todo.workId)) {
        todosByWorkId.set(todo.workId, []);
      }
      todosByWorkId.get(todo.workId)!.push({
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
   * Optimized to avoid N+1 queries
   */
  async findByIdsWithDetails(workIds: string[]): Promise<Map<string, WorkNoteDetail>> {
    if (workIds.length === 0) {
      return new Map();
    }

    const placeholders = workIds.map(() => '?').join(',');

    // Fetch all work notes
    const workNotesResult = await this.db
      .prepare(
        `SELECT work_id as workId, title, content_raw as contentRaw,
                category, created_at as createdAt, updated_at as updatedAt,
                embedded_at as embeddedAt
         FROM work_notes
         WHERE work_id IN (${placeholders})`
      )
      .bind(...workIds)
      .all<WorkNote>();

    const workNotes = workNotesResult.results || [];

    if (workNotes.length === 0) {
      return new Map();
    }

    // Fetch all persons in a single query
    const personsResult = await this.db
      .prepare(
        `SELECT wnp.id, wnp.work_id as workId, wnp.person_id as personId,
                wnp.role, p.name as personName, p.current_dept as currentDept,
                p.current_position as currentPosition
         FROM work_note_person wnp
         INNER JOIN persons p ON wnp.person_id = p.person_id
         WHERE wnp.work_id IN (${placeholders})`
      )
      .bind(...workIds)
      .all<WorkNotePersonAssociation & { workId: string }>();

    // Group persons by workId
    const personsByWorkId = new Map<string, WorkNotePersonAssociation[]>();
    for (const person of personsResult.results || []) {
      if (!personsByWorkId.has(person.workId)) {
        personsByWorkId.set(person.workId, []);
      }
      personsByWorkId.get(person.workId)!.push({
        id: person.id,
        workId: person.workId,
        personId: person.personId,
        role: person.role,
        personName: person.personName,
        currentDept: person.currentDept,
        currentPosition: person.currentPosition,
      });
    }

    // Build result map
    const result = new Map<string, WorkNoteDetail>();
    for (const workNote of workNotes) {
      result.set(workNote.workId, {
        ...workNote,
        persons: personsByWorkId.get(workNote.workId) || [],
        relatedWorkNotes: [],
        categories: [],
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
             wn.category, wn.created_at as createdAt, wn.updated_at as updatedAt,
             wn.embedded_at as embeddedAt
      FROM work_notes wn
    `;

    const conditions: string[] = [];
    const params: (string | null)[] = [];

    // Filter by person
    if (query.personId) {
      sql += ` INNER JOIN work_note_person wnp ON wn.work_id = wnp.work_id`;
      conditions.push(`wnp.person_id = ?`);
      params.push(query.personId);
    }

    // Filter by department
    if (query.deptName) {
      sql += `
        INNER JOIN work_note_person wnp2 ON wn.work_id = wnp2.work_id
        INNER JOIN person_dept_history pdh ON wnp2.person_id = pdh.person_id
      `;
      conditions.push(`pdh.dept_name = ?`);
      params.push(query.deptName);
    }

    // Filter by category
    if (query.category) {
      conditions.push(`wn.category = ?`);
      params.push(query.category);
    }

    // Filter by keyword search
    if (query.q) {
      conditions.push(`(wn.title LIKE ? OR wn.content_raw LIKE ?)`);
      params.push(`%${query.q}%`, `%${query.q}%`);
    }

    // Filter by date range
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

    const stmt = this.db.prepare(sql);
    const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all<WorkNote>();

    const workNotes = result.results || [];

    // Batch fetch categories and persons for all work notes to avoid N+1 queries
    const workIds = workNotes.map((wn) => wn.workId);

    if (workIds.length === 0) {
      return [];
    }

    // Fetch all categories in a single query
    const placeholders = workIds.map(() => '?').join(',');
    const categoriesResult = await this.db
      .prepare(
        `SELECT wntc.work_id as workId, tc.category_id as categoryId, tc.name, tc.is_active as isActive, tc.created_at as createdAt
         FROM task_categories tc
         INNER JOIN work_note_task_category wntc ON tc.category_id = wntc.category_id
         WHERE wntc.work_id IN (${placeholders})`
      )
      .bind(...workIds)
      .all<{ workId: string; categoryId: string; name: string; isActive: number; createdAt: string }>();

    // Fetch all persons in a single query
    const personsResult = await this.db
      .prepare(
        `SELECT wnp.id, wnp.work_id as workId, wnp.person_id as personId,
                wnp.role, p.name as personName, p.current_dept as currentDept,
                p.current_position as currentPosition
         FROM work_note_person wnp
         INNER JOIN persons p ON wnp.person_id = p.person_id
         WHERE wnp.work_id IN (${placeholders})`
      )
      .bind(...workIds)
      .all<WorkNotePersonAssociation & { workId: string }>();

    // Group categories and persons by workId
    const categoriesByWorkId = new Map<string, TaskCategory[]>();
    const personsByWorkId = new Map<string, WorkNotePersonAssociation[]>();

    for (const cat of categoriesResult.results || []) {
      if (!categoriesByWorkId.has(cat.workId)) {
        categoriesByWorkId.set(cat.workId, []);
      }
      categoriesByWorkId.get(cat.workId)!.push({
        categoryId: cat.categoryId,
        name: cat.name,
        isActive: cat.isActive === 1,
        createdAt: cat.createdAt,
      });
    }

    for (const person of personsResult.results || []) {
      if (!personsByWorkId.has(person.workId)) {
        personsByWorkId.set(person.workId, []);
      }
      personsByWorkId.get(person.workId)!.push({
        id: person.id,
        workId: person.workId,
        personId: person.personId,
        role: person.role,
        personName: person.personName,
        currentDept: person.currentDept,
        currentPosition: person.currentPosition,
      });
    }

    // Map results to work notes
    return workNotes.map((workNote) => ({
      ...workNote,
      persons: personsByWorkId.get(workNote.workId) || [],
      relatedWorkNotes: [],
      categories: categoriesByWorkId.get(workNote.workId) || [],
    }));
  }

  /**
   * Create new work note with person associations and first version
   */
  async create(data: CreateWorkNoteInput): Promise<WorkNote> {
    const now = new Date().toISOString();
    const workId = this.generateWorkId();

    const statements = [
      // Insert work note
      this.db
        .prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, category, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(workId, data.title, data.contentRaw, data.category || null, now, now),

      // Insert first version
      this.db
        .prepare(
          `INSERT INTO work_note_versions (work_id, version_no, title, content_raw, category, created_at)
           VALUES (?, 1, ?, ?, ?, ?)`
        )
        .bind(workId, data.title, data.contentRaw, data.category || null, now),
    ];

    // Add person associations with snapshot of current department and position
    if (data.persons && data.persons.length > 0) {
      // Fetch current department and position for all persons
      const personIds = data.persons.map((p) => p.personId);
      const placeholders = personIds.map(() => '?').join(', ');
      const personsInfo = await this.db
        .prepare(
          `SELECT person_id, current_dept, current_position FROM persons WHERE person_id IN (${placeholders})`
        )
        .bind(...personIds)
        .all<{ person_id: string; current_dept: string | null; current_position: string | null }>();

      const personInfoMap = new Map<string, { currentDept: string | null; currentPosition: string | null }>();
      for (const info of personsInfo.results || []) {
        personInfoMap.set(info.person_id, {
          currentDept: info.current_dept,
          currentPosition: info.current_position,
        });
      }

      for (const person of data.persons) {
        const info = personInfoMap.get(person.personId);
        statements.push(
          this.db
            .prepare(
              `INSERT INTO work_note_person (work_id, person_id, role, dept_at_time, position_at_time)
               VALUES (?, ?, ?, ?, ?)`
            )
            .bind(
              workId,
              person.personId,
              person.role,
              info?.currentDept || null,
              info?.currentPosition || null
            )
        );
      }
    }

    // Add related work note associations
    if (data.relatedWorkIds && data.relatedWorkIds.length > 0) {
      for (const relatedWorkId of data.relatedWorkIds) {
        statements.push(
          this.db
            .prepare(
              `INSERT INTO work_note_relation (work_id, related_work_id)
               VALUES (?, ?)`
            )
            .bind(workId, relatedWorkId)
        );
      }
    }

    // Add task category associations
    if (data.categoryIds && data.categoryIds.length > 0) {
      for (const categoryId of data.categoryIds) {
        statements.push(
          this.db
            .prepare(
              `INSERT INTO work_note_task_category (work_id, category_id)
               VALUES (?, ?)`
            )
            .bind(workId, categoryId)
        );
      }
    }

    await this.db.batch(statements);

    // Return the created work note without extra DB roundtrip
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
    const statements = [];

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
      updateFields.push('embedded_at = NULL'); // Reset embedding status on content change
      updateParams.push(now);
      updateParams.push(workId);

      statements.push(
        this.db
          .prepare(`UPDATE work_notes SET ${updateFields.join(', ')} WHERE work_id = ?`)
          .bind(...updateParams)
      );

      // Get next version number
      const versionCountResult = await this.db
        .prepare(`SELECT COALESCE(MAX(version_no), 0) + 1 as nextVersion FROM work_note_versions WHERE work_id = ?`)
        .bind(workId)
        .first<{ nextVersion: number }>();

      const nextVersionNo = versionCountResult?.nextVersion || 1;

      // Create new version
      statements.push(
        this.db
          .prepare(
            `INSERT INTO work_note_versions (work_id, version_no, title, content_raw, category, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(
            workId,
            nextVersionNo,
            data.title || existing.title,
            data.contentRaw || existing.contentRaw,
            data.category !== undefined ? (data.category || null) : existing.category,
            now
          )
      );

      // Prune old versions (keep max 5)
      statements.push(
        this.db
          .prepare(
            `DELETE FROM work_note_versions
             WHERE id IN (
               SELECT id FROM work_note_versions
               WHERE work_id = ?
               ORDER BY version_no DESC
               LIMIT -1 OFFSET ?
             )`
          )
          .bind(workId, MAX_VERSIONS)
      );
    }

    // Update person associations if provided
    if (data.persons !== undefined) {
      // Delete existing associations
      statements.push(
        this.db.prepare(`DELETE FROM work_note_person WHERE work_id = ?`).bind(workId)
      );

      // Add new associations with snapshot of current department and position
      if (data.persons.length > 0) {
        // Fetch current department and position for all persons
        const personIds = data.persons.map((p) => p.personId);
        const placeholders = personIds.map(() => '?').join(', ');
        const personsInfo = await this.db
          .prepare(
            `SELECT person_id, current_dept, current_position FROM persons WHERE person_id IN (${placeholders})`
          )
          .bind(...personIds)
          .all<{ person_id: string; current_dept: string | null; current_position: string | null }>();

        const personInfoMap = new Map<string, { currentDept: string | null; currentPosition: string | null }>();
        for (const info of personsInfo.results || []) {
          personInfoMap.set(info.person_id, {
            currentDept: info.current_dept,
            currentPosition: info.current_position,
          });
        }

        for (const person of data.persons) {
          const info = personInfoMap.get(person.personId);
          statements.push(
            this.db
              .prepare(
                `INSERT INTO work_note_person (work_id, person_id, role, dept_at_time, position_at_time)
                 VALUES (?, ?, ?, ?, ?)`
              )
              .bind(
                workId,
                person.personId,
                person.role,
                info?.currentDept || null,
                info?.currentPosition || null
              )
          );
        }
      }
    }

    // Update related work notes if provided
    if (data.relatedWorkIds !== undefined) {
      // Delete existing relations
      statements.push(
        this.db.prepare(`DELETE FROM work_note_relation WHERE work_id = ?`).bind(workId)
      );

      // Add new relations
      for (const relatedWorkId of data.relatedWorkIds) {
        statements.push(
          this.db
            .prepare(
              `INSERT INTO work_note_relation (work_id, related_work_id)
               VALUES (?, ?)`
            )
            .bind(workId, relatedWorkId)
        );
      }
    }

    // Update task category associations if provided
    if (data.categoryIds !== undefined) {
      // Delete existing category associations
      statements.push(
        this.db.prepare(`DELETE FROM work_note_task_category WHERE work_id = ?`).bind(workId)
      );

      // Add new category associations
      for (const categoryId of data.categoryIds) {
        statements.push(
          this.db
            .prepare(
              `INSERT INTO work_note_task_category (work_id, category_id)
               VALUES (?, ?)`
            )
            .bind(workId, categoryId)
        );
      }
    }

    if (statements.length > 0) {
      await this.db.batch(statements);
    }

    // Return the updated work note without extra DB roundtrip
    // Reset embeddedAt to null only if content changed (needs re-embedding)
    return {
      ...existing,
      title: data.title !== undefined ? data.title : existing.title,
      contentRaw: data.contentRaw !== undefined ? data.contentRaw : existing.contentRaw,
      category: data.category !== undefined ? (data.category || null) : existing.category,
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

    await this.db.prepare(`DELETE FROM work_notes WHERE work_id = ?`).bind(workId).run();
  }

  /**
   * Get versions for a work note
   */
  async getVersions(workId: string): Promise<WorkNoteVersion[]> {
    const workNote = await this.findById(workId);
    if (!workNote) {
      throw new NotFoundError('Work note', workId);
    }

    const result = await this.db
      .prepare(
        `SELECT id, work_id as workId, version_no as versionNo,
                title, content_raw as contentRaw, category, created_at as createdAt
         FROM work_note_versions
         WHERE work_id = ?
         ORDER BY version_no DESC`
      )
      .bind(workId)
      .all<WorkNoteVersion>();

    return result.results || [];
  }

  /**
   * Get department name for a person
   *
   * @param personId - Person ID
   * @returns Department name or null
   */
  async getDeptNameForPerson(personId: string): Promise<string | null> {
    const result = await this.db
      .prepare('SELECT current_dept FROM persons WHERE person_id = ?')
      .bind(personId)
      .first<{ current_dept: string | null }>();

    return result?.current_dept || null;
  }

  /**
   * Update embedded_at timestamp for a work note
   * Called after successful embedding
   *
   * @param workId - Work note ID
   */
  async updateEmbeddedAt(workId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare('UPDATE work_notes SET embedded_at = ? WHERE work_id = ?')
      .bind(now, workId)
      .run();
  }

  /**
   * Get count of embedded and non-embedded work notes
   */
  async getEmbeddingStats(): Promise<{ total: number; embedded: number; pending: number }> {
    const result = await this.db
      .prepare(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN embedded_at IS NOT NULL THEN 1 ELSE 0 END) as embedded,
           SUM(CASE WHEN embedded_at IS NULL THEN 1 ELSE 0 END) as pending
         FROM work_notes`
      )
      .first<{ total: number; embedded: number; pending: number }>();

    return {
      total: result?.total || 0,
      embedded: result?.embedded || 0,
      pending: result?.pending || 0,
    };
  }

  /**
   * Find work notes that are not yet embedded
   *
   * @param limit - Maximum number of notes to return
   * @param offset - Offset for pagination
   */
  async findPendingEmbedding(limit: number = 10, offset: number = 0): Promise<WorkNote[]> {
    const result = await this.db
      .prepare(
        `SELECT work_id as workId, title, content_raw as contentRaw,
                category, created_at as createdAt, updated_at as updatedAt,
                embedded_at as embeddedAt
         FROM work_notes
         WHERE embedded_at IS NULL
         ORDER BY created_at ASC
         LIMIT ? OFFSET ?`
      )
      .bind(limit, offset)
      .all<WorkNote>();

    return result.results || [];
  }
}
