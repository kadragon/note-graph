// Trace: SPEC-worknote-1, TASK-007, TASK-003
/**
 * Work note repository for D1 database operations
 */

import type { D1Database } from '@cloudflare/workers-types';
import { nanoid } from 'nanoid';
import type { WorkNote, WorkNoteDetail, WorkNoteVersion, WorkNotePersonAssociation, WorkNoteRelation } from '../types/work-note';
import type { CreateWorkNoteInput, UpdateWorkNoteInput, ListWorkNotesQuery } from '../schemas/work-note';
import type { TaskCategory } from '../types/task-category';
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
        `SELECT work_id as workId, work_id as id, title, content_raw as contentRaw,
                category, created_at as createdAt, updated_at as updatedAt
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
                  wnp.role, p.name as personName
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
   * Find all work notes with filters
   */
  async findAll(query: ListWorkNotesQuery): Promise<WorkNote[]> {
    let sql = `
      SELECT DISTINCT wn.work_id as workId, wn.work_id as id, wn.title, wn.content_raw as contentRaw,
             wn.category, wn.created_at as createdAt, wn.updated_at as updatedAt
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

    return result.results || [];
  }

  /**
   * Create new work note with person associations and first version
   */
  async create(data: CreateWorkNoteInput): Promise<WorkNote & { id: string }> {
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

    // Add person associations
    if (data.persons && data.persons.length > 0) {
      for (const person of data.persons) {
        statements.push(
          this.db
            .prepare(
              `INSERT INTO work_note_person (work_id, person_id, role)
               VALUES (?, ?, ?)`
            )
            .bind(workId, person.personId, person.role)
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
      id: workId,
      title: data.title,
      contentRaw: data.contentRaw,
      category: data.category || null,
      createdAt: now,
      updatedAt: now,
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

      // Add new associations
      for (const person of data.persons) {
        statements.push(
          this.db
            .prepare(
              `INSERT INTO work_note_person (work_id, person_id, role)
               VALUES (?, ?, ?)`
            )
            .bind(workId, person.personId, person.role)
        );
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
    return {
      ...existing,
      title: data.title !== undefined ? data.title : existing.title,
      contentRaw: data.contentRaw !== undefined ? data.contentRaw : existing.contentRaw,
      category: data.category !== undefined ? (data.category || null) : existing.category,
      updatedAt: updateFields.length > 0 ? now : existing.updatedAt,
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
}
