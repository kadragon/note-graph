// Trace: SPEC-person-1, SPEC-person-3, TASK-005, TASK-018, TASK-027
/**
 * Person repository for D1 database operations
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { Person, PersonDeptHistory, PersonWorkNote } from '../types/person';
import type { CreatePersonInput, UpdatePersonInput } from '../schemas/person';
import { NotFoundError, ConflictError, ValidationError } from '../types/errors';

export class PersonRepository {
  constructor(private db: D1Database) {}

  /**
   * Ensure the provided department exists, otherwise throw validation error
   */
  private async ensureDepartmentExists(deptName: string): Promise<void> {
    const exists = await this.db
      .prepare('SELECT 1 as present FROM departments WHERE dept_name = ?')
      .bind(deptName)
      .first<{ present: number }>();

    if (!exists) {
      throw new ValidationError('존재하지 않는 부서입니다. 부서를 먼저 생성해주세요.', { deptName });
    }
  }

  /**
   * Find person by ID
   */
  async findById(personId: string): Promise<Person | null> {
    const result = await this.db
      .prepare(
        `SELECT person_id as personId, name, phone_ext as phoneExt,
                current_dept as currentDept, current_position as currentPosition,
                current_role_desc as currentRoleDesc,
                employment_status as employmentStatus,
                created_at as createdAt, updated_at as updatedAt
         FROM persons
         WHERE person_id = ?`
      )
      .bind(personId)
      .first<Person>();

    return result || null;
  }

  /**
   * Find all persons with optional search query
   * Sorted by department (nulls last) then name
   */
  async findAll(searchQuery?: string): Promise<Person[]> {
    let query = `SELECT person_id as personId, name, phone_ext as phoneExt,
                        current_dept as currentDept, current_position as currentPosition,
                        current_role_desc as currentRoleDesc,
                        employment_status as employmentStatus,
                        created_at as createdAt, updated_at as updatedAt
                 FROM persons`;
    const params: string[] = [];

    if (searchQuery) {
      query += ` WHERE name LIKE ? OR person_id LIKE ?`;
      params.push(`%${searchQuery}%`, `%${searchQuery}%`);
    }

    // Sort by department (nulls last) then name
    query += ` ORDER BY current_dept ASC NULLS LAST, name ASC`;

    const stmt = this.db.prepare(query);
    const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all<Person>();

    return result.results || [];
  }

  /**
   * Create new person with optional department history entry
   */
  async create(data: CreatePersonInput): Promise<Person> {
    const now = new Date().toISOString();

    // Check if person already exists
    const existing = await this.findById(data.personId);
    if (existing) {
      throw new ConflictError(`Person already exists with ID: ${data.personId}`);
    }

    // Validate department existence before inserting history
    if (data.currentDept) {
      await this.ensureDepartmentExists(data.currentDept);
    }

    const statements = [
      // Insert person
      this.db
        .prepare(
          `INSERT INTO persons (person_id, name, phone_ext, current_dept, current_position, current_role_desc, employment_status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          data.personId,
          data.name,
          data.phoneExt || null,
          data.currentDept || null,
          data.currentPosition || null,
          data.currentRoleDesc || null,
          data.employmentStatus || '재직',
          now,
          now
        ),
    ];

    // Create initial department history entry if department is provided
    if (data.currentDept) {
      statements.push(
        this.db
          .prepare(
            `INSERT INTO person_dept_history (person_id, dept_name, position, role_desc, start_date, is_active)
             VALUES (?, ?, ?, ?, ?, 1)`
          )
          .bind(
            data.personId,
            data.currentDept,
            data.currentPosition || null,
            data.currentRoleDesc || null,
            now
          )
      );
    }

    await this.db.batch(statements);

    // Return the created person without extra DB roundtrip
    return {
      personId: data.personId,
      name: data.name,
      phoneExt: data.phoneExt || null,
      currentDept: data.currentDept || null,
      currentPosition: data.currentPosition || null,
      currentRoleDesc: data.currentRoleDesc || null,
      employmentStatus: data.employmentStatus || '재직',
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Update person and manage department history
   */
  async update(personId: string, data: UpdatePersonInput): Promise<Person> {
    const existing = await this.findById(personId);
    if (!existing) {
      throw new NotFoundError('Person', personId);
    }

    const now = new Date().toISOString();
    const statements = [];

    // Check if department is being changed
    const isDeptChanging = data.currentDept !== undefined && data.currentDept !== existing.currentDept;

    if (isDeptChanging) {
      if (data.currentDept) {
        await this.ensureDepartmentExists(data.currentDept);
      }

      // Deactivate current department history entry
      statements.push(
        this.db
          .prepare(
            `UPDATE person_dept_history
             SET is_active = 0, end_date = ?
             WHERE person_id = ? AND is_active = 1`
          )
          .bind(now, personId)
      );

      // Create new department history entry
      if (data.currentDept) {
        statements.push(
          this.db
            .prepare(
              `INSERT INTO person_dept_history (person_id, dept_name, position, role_desc, start_date, is_active)
               VALUES (?, ?, ?, ?, ?, 1)`
            )
            .bind(
              personId,
              data.currentDept,
              data.currentPosition || existing.currentPosition || null,
              data.currentRoleDesc || existing.currentRoleDesc || null,
              now
            )
        );
      }
    }

    // Update person record
    const updateFields: string[] = [];
    const updateParams: (string | null)[] = [];

    if (data.name !== undefined) {
      updateFields.push('name = ?');
      updateParams.push(data.name);
    }
    if (data.phoneExt !== undefined) {
      updateFields.push('phone_ext = ?');
      updateParams.push(data.phoneExt || null);
    }
    if (data.currentDept !== undefined) {
      updateFields.push('current_dept = ?');
      updateParams.push(data.currentDept || null);
    }
    if (data.currentPosition !== undefined) {
      updateFields.push('current_position = ?');
      updateParams.push(data.currentPosition || null);
    }
    if (data.currentRoleDesc !== undefined) {
      updateFields.push('current_role_desc = ?');
      updateParams.push(data.currentRoleDesc || null);
    }
    if (data.employmentStatus !== undefined) {
      updateFields.push('employment_status = ?');
      updateParams.push(data.employmentStatus);
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = ?');
      updateParams.push(now);
      updateParams.push(personId);

      statements.push(
        this.db
          .prepare(`UPDATE persons SET ${updateFields.join(', ')} WHERE person_id = ?`)
          .bind(...updateParams)
      );
    }

    if (statements.length > 0) {
      await this.db.batch(statements);
    }

    // Return the updated person without extra DB roundtrip
    return {
      ...existing,
      name: data.name !== undefined ? data.name : existing.name,
      phoneExt: data.phoneExt !== undefined ? (data.phoneExt || null) : existing.phoneExt,
      currentDept: data.currentDept !== undefined ? (data.currentDept || null) : existing.currentDept,
      currentPosition: data.currentPosition !== undefined ? (data.currentPosition || null) : existing.currentPosition,
      currentRoleDesc: data.currentRoleDesc !== undefined ? (data.currentRoleDesc || null) : existing.currentRoleDesc,
      employmentStatus: data.employmentStatus !== undefined ? data.employmentStatus : existing.employmentStatus,
      updatedAt: updateFields.length > 0 ? now : existing.updatedAt,
    };
  }

  /**
   * Get person's department history
   */
  async getDepartmentHistory(personId: string): Promise<PersonDeptHistory[]> {
    const person = await this.findById(personId);
    if (!person) {
      throw new NotFoundError('Person', personId);
    }

    const result = await this.db
      .prepare(
        `SELECT id, person_id as personId, dept_name as deptName,
                position, role_desc as roleDesc, start_date as startDate,
                end_date as endDate, is_active as isActive
         FROM person_dept_history
         WHERE person_id = ?
         ORDER BY start_date DESC`
      )
      .bind(personId)
      .all<PersonDeptHistory>();

    return result.results || [];
  }

  /**
   * Get person's associated work notes
   */
  async getWorkNotes(personId: string): Promise<PersonWorkNote[]> {
    const person = await this.findById(personId);
    if (!person) {
      throw new NotFoundError('Person', personId);
    }

    const result = await this.db
      .prepare(
        `SELECT
          wn.work_id as workId,
          wn.title,
          wn.category,
          wnp.role,
          wn.created_at as createdAt,
          wn.updated_at as updatedAt
         FROM work_notes wn
         INNER JOIN work_note_person wnp ON wn.work_id = wnp.work_id
         WHERE wnp.person_id = ?
         ORDER BY wn.created_at DESC`
      )
      .bind(personId)
      .all<PersonWorkNote>();

    return result.results || [];
  }
}
