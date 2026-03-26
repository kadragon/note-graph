// Trace: SPEC-person-1, SPEC-person-3, TASK-005, TASK-018, TASK-027, TASK-045, TASK-058
/**
 * Person repository for database operations
 */

import type { Person, PersonDeptHistory, PersonWorkNote } from '@shared/types/person';
import type { CreatePersonInput, UpdatePersonInput } from '../schemas/person';
import type { DatabaseClient } from '../types/database';
import { ConflictError, NotFoundError, ValidationError } from '../types/errors';
import { pgPlaceholders } from '../utils/db-utils';

export interface PersonRepositoryOptions {
  autoCreateDepartment?: boolean;
}

export class PersonRepository {
  constructor(
    private db: DatabaseClient,
    private options: PersonRepositoryOptions = {}
  ) {}

  /**
   * Check if department exists
   */
  private async departmentExists(deptName: string): Promise<boolean> {
    const exists = await this.db.queryOne<{ present: number }>(
      'SELECT 1 as present FROM departments WHERE dept_name = $1',
      [deptName]
    );

    return !!exists;
  }

  /**
   * Helper to check department existence and collect auto-creation statements
   */
  private async handleDepartmentCreation(
    deptName: string,
    statements: Array<{ sql: string; params?: unknown[] }>
  ): Promise<void> {
    const deptExists = await this.departmentExists(deptName);
    if (!deptExists) {
      if (this.options.autoCreateDepartment) {
        const now = new Date().toISOString();
        statements.push({
          sql: `INSERT INTO departments (dept_name, description, is_active, created_at)
                VALUES ($1, NULL, TRUE, $2)`,
          params: [deptName, now],
        });
      } else {
        throw new ValidationError('존재하지 않는 부서입니다. 부서를 먼저 생성해주세요.', {
          deptName,
        });
      }
    }
  }

  /**
   * Find person by ID
   */
  async findById(personId: string): Promise<Person | null> {
    return this.db.queryOne<Person>(
      `SELECT person_id as "personId", name, phone_ext as "phoneExt",
              current_dept as "currentDept", current_position as "currentPosition",
              current_role_desc as "currentRoleDesc",
              employment_status as "employmentStatus",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM persons
       WHERE person_id = $1`,
      [personId]
    );
  }

  /**
   * Find persons by IDs in a single query
   */
  async findByIds(personIds: string[]): Promise<Person[]> {
    if (personIds.length === 0) {
      return [];
    }

    const uniquePersonIds = [...new Set(personIds)];
    const placeholders = pgPlaceholders(uniquePersonIds.length);

    const result = await this.db.query<Person>(
      `SELECT person_id as "personId", name, phone_ext as "phoneExt",
              current_dept as "currentDept", current_position as "currentPosition",
              current_role_desc as "currentRoleDesc",
              employment_status as "employmentStatus",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM persons
       WHERE person_id IN (${placeholders})`,
      uniquePersonIds
    );

    const personById = new Map(result.rows.map((person) => [person.personId, person]));
    return uniquePersonIds
      .map((personId) => personById.get(personId))
      .filter((person) => person !== undefined);
  }

  /**
   * Find all persons with optional search query
   */
  async findAll(searchQuery?: string): Promise<Person[]> {
    let query = `SELECT person_id as "personId", name, phone_ext as "phoneExt",
                        current_dept as "currentDept", current_position as "currentPosition",
                        current_role_desc as "currentRoleDesc",
                        employment_status as "employmentStatus",
                        created_at as "createdAt", updated_at as "updatedAt"
                 FROM persons`;
    const params: string[] = [];

    if (searchQuery) {
      query += ` WHERE name LIKE $1 OR person_id LIKE $2`;
      params.push(`%${searchQuery}%`, `%${searchQuery}%`);
    }

    query += ` ORDER BY current_dept ASC NULLS LAST, name ASC, current_position ASC NULLS LAST, person_id ASC, phone_ext ASC NULLS LAST, created_at ASC`;

    const result = await this.db.query<Person>(query, params);
    return result.rows;
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

    const statements: Array<{ sql: string; params?: unknown[] }> = [];

    // Handle department: check existence and optionally auto-create
    if (data.currentDept) {
      await this.handleDepartmentCreation(data.currentDept, statements);
    }

    // Insert person
    statements.push({
      sql: `INSERT INTO persons (person_id, name, phone_ext, current_dept, current_position, current_role_desc, employment_status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      params: [
        data.personId,
        data.name,
        data.phoneExt || null,
        data.currentDept || null,
        data.currentPosition || null,
        data.currentRoleDesc || null,
        data.employmentStatus || '재직',
        now,
        now,
      ],
    });

    // Create initial department history entry if department is provided
    if (data.currentDept) {
      statements.push({
        sql: `INSERT INTO person_dept_history (person_id, dept_name, position, role_desc, start_date, is_active)
              VALUES ($1, $2, $3, $4, $5, TRUE)`,
        params: [
          data.personId,
          data.currentDept,
          data.currentPosition || null,
          data.currentRoleDesc || null,
          now,
        ],
      });
    }

    await this.db.executeBatch(statements);

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
    const statements: Array<{ sql: string; params?: unknown[] }> = [];

    // Check if department is being changed
    const isDeptChanging =
      data.currentDept !== undefined && data.currentDept !== existing.currentDept;

    if (isDeptChanging) {
      // Handle department: check existence and optionally auto-create
      if (data.currentDept) {
        await this.handleDepartmentCreation(data.currentDept, statements);
      }

      // Deactivate current department history entry
      statements.push({
        sql: `UPDATE person_dept_history
              SET is_active = FALSE, end_date = $1
              WHERE person_id = $2 AND is_active`,
        params: [now, personId],
      });

      // Create new department history entry
      if (data.currentDept) {
        statements.push({
          sql: `INSERT INTO person_dept_history (person_id, dept_name, position, role_desc, start_date, is_active)
                VALUES ($1, $2, $3, $4, $5, TRUE)`,
          params: [
            personId,
            data.currentDept,
            data.currentPosition || existing.currentPosition || null,
            data.currentRoleDesc || existing.currentRoleDesc || null,
            now,
          ],
        });
      }
    }

    // Update person record
    const updateFields: string[] = [];
    const updateParams: (string | null)[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      updateParams.push(data.name);
    }
    if (data.phoneExt !== undefined) {
      updateFields.push(`phone_ext = $${paramIndex++}`);
      updateParams.push(data.phoneExt || null);
    }
    if (data.currentDept !== undefined) {
      updateFields.push(`current_dept = $${paramIndex++}`);
      updateParams.push(data.currentDept || null);
    }
    if (data.currentPosition !== undefined) {
      updateFields.push(`current_position = $${paramIndex++}`);
      updateParams.push(data.currentPosition || null);
    }
    if (data.currentRoleDesc !== undefined) {
      updateFields.push(`current_role_desc = $${paramIndex++}`);
      updateParams.push(data.currentRoleDesc || null);
    }
    if (data.employmentStatus !== undefined) {
      updateFields.push(`employment_status = $${paramIndex++}`);
      updateParams.push(data.employmentStatus);
    }

    if (updateFields.length > 0) {
      updateFields.push(`updated_at = $${paramIndex++}`);
      updateParams.push(now);
      updateParams.push(personId);

      statements.push({
        sql: `UPDATE persons SET ${updateFields.join(', ')} WHERE person_id = $${paramIndex}`,
        params: updateParams,
      });
    }

    if (statements.length > 0) {
      await this.db.executeBatch(statements);
    }

    // Return the updated person without extra DB roundtrip
    return {
      ...existing,
      name: data.name !== undefined ? data.name : existing.name,
      phoneExt: data.phoneExt !== undefined ? data.phoneExt || null : existing.phoneExt,
      currentDept: data.currentDept !== undefined ? data.currentDept || null : existing.currentDept,
      currentPosition:
        data.currentPosition !== undefined
          ? data.currentPosition || null
          : existing.currentPosition,
      currentRoleDesc:
        data.currentRoleDesc !== undefined
          ? data.currentRoleDesc || null
          : existing.currentRoleDesc,
      employmentStatus:
        data.employmentStatus !== undefined ? data.employmentStatus : existing.employmentStatus,
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

    const result = await this.db.query<PersonDeptHistory>(
      `SELECT id, person_id as "personId", dept_name as "deptName",
              position, role_desc as "roleDesc", start_date as "startDate",
              end_date as "endDate", is_active as "isActive"
       FROM person_dept_history
       WHERE person_id = $1
       ORDER BY start_date DESC, id DESC`,
      [personId]
    );

    return result.rows;
  }

  /**
   * Get person's associated work notes
   */
  async getWorkNotes(personId: string): Promise<PersonWorkNote[]> {
    const person = await this.findById(personId);
    if (!person) {
      throw new NotFoundError('Person', personId);
    }

    const result = await this.db.query<PersonWorkNote>(
      `SELECT
        wn.work_id as "workId",
        wn.title,
        wn.category,
        wnp.role,
        wn.created_at as "createdAt",
        wn.updated_at as "updatedAt"
       FROM work_notes wn
       INNER JOIN work_note_person wnp ON wn.work_id = wnp.work_id
       WHERE wnp.person_id = $1
       ORDER BY wn.created_at DESC`,
      [personId]
    );

    return result.rows;
  }
}
