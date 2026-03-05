// Trace: SPEC-dept-1, TASK-006, TASK-020
/**
 * Department repository for database operations
 */

import type { Department, DepartmentMember, DepartmentWorkNote } from '@shared/types/department';
import type { CreateDepartmentInput, UpdateDepartmentInput } from '../schemas/department';
import type { DatabaseClient } from '../types/database';
import { ConflictError, NotFoundError } from '../types/errors';

export class DepartmentRepository {
  constructor(private db: DatabaseClient) {}

  /**
   * Find department by name
   */
  async findByName(deptName: string): Promise<Department | null> {
    return this.db.queryOne<Department>(
      `SELECT dept_name as deptName, description, is_active as isActive, created_at as createdAt
       FROM departments
       WHERE dept_name = ?`,
      [deptName]
    );
  }

  /**
   * Find all departments
   */
  async findAll(searchQuery?: string, limit: number = 100): Promise<Department[]> {
    let sql = `SELECT dept_name as deptName, description, is_active as isActive, created_at as createdAt
               FROM departments`;
    const params: (string | number)[] = [];

    if (searchQuery) {
      sql += ` WHERE dept_name LIKE ?`;
      params.push(`%${searchQuery}%`);
    }

    sql += ` ORDER BY is_active DESC, dept_name ASC LIMIT ?`;
    params.push(limit);

    const result = await this.db.query<Department>(sql, params);
    return result.rows;
  }

  /**
   * Create new department
   */
  async create(data: CreateDepartmentInput): Promise<Department> {
    const now = new Date().toISOString();

    // Check if department already exists
    const existing = await this.findByName(data.deptName);
    if (existing) {
      throw new ConflictError(`Department already exists: ${data.deptName}`);
    }

    await this.db.execute(
      `INSERT INTO departments (dept_name, description, is_active, created_at)
       VALUES (?, ?, 1, ?)`,
      [data.deptName, data.description || null, now]
    );

    // Return the created department without extra DB roundtrip
    return {
      deptName: data.deptName,
      description: data.description || null,
      isActive: true,
      createdAt: now,
    };
  }

  /**
   * Update department
   */
  async update(deptName: string, data: UpdateDepartmentInput): Promise<Department> {
    const existing = await this.findByName(deptName);
    if (!existing) {
      throw new NotFoundError('Department', deptName);
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description || null);
    }

    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(data.isActive ? 1 : 0);
    }

    // Only run update if there are fields to update
    if (updates.length > 0) {
      params.push(deptName);
      await this.db.execute(
        `UPDATE departments
         SET ${updates.join(', ')}
         WHERE dept_name = ?`,
        params
      );
    }

    // Return the updated department without extra DB roundtrip
    return {
      ...existing,
      description: data.description !== undefined ? data.description || null : existing.description,
      isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
    };
  }

  /**
   * Get department members (current and historical)
   */
  async getMembers(deptName: string, onlyActive: boolean = false): Promise<DepartmentMember[]> {
    const department = await this.findByName(deptName);
    if (!department) {
      throw new NotFoundError('Department', deptName);
    }

    let query = `
      SELECT
        pdh.person_id as personId,
        p.name,
        pdh.position,
        pdh.role_desc as roleDesc,
        pdh.start_date as startDate,
        pdh.end_date as endDate,
        pdh.is_active as isActive
      FROM person_dept_history pdh
      INNER JOIN persons p ON pdh.person_id = p.person_id
      WHERE pdh.dept_name = ?
    `;

    if (onlyActive) {
      query += ` AND pdh.is_active = 1`;
    }

    query += ` ORDER BY pdh.start_date DESC`;

    const result = await this.db.query<DepartmentMember>(query, [deptName]);
    return result.rows;
  }

  /**
   * Get department's work notes
   */
  async getWorkNotes(deptName: string): Promise<DepartmentWorkNote[]> {
    const department = await this.findByName(deptName);
    if (!department) {
      throw new NotFoundError('Department', deptName);
    }

    const result = await this.db.query<DepartmentWorkNote>(
      `SELECT DISTINCT
        wn.work_id as workId,
        wn.title,
        wn.category,
        wn.created_at as createdAt,
        wn.updated_at as updatedAt,
        owner.person_id as ownerPersonId,
        owner_person.name as ownerPersonName
       FROM work_notes wn
       INNER JOIN work_note_person wnp ON wn.work_id = wnp.work_id
       INNER JOIN person_dept_history pdh ON wnp.person_id = pdh.person_id
       LEFT JOIN work_note_person owner ON wn.work_id = owner.work_id AND owner.role = 'OWNER'
       LEFT JOIN persons owner_person ON owner.person_id = owner_person.person_id
       WHERE pdh.dept_name = ?
       ORDER BY wn.created_at DESC`,
      [deptName]
    );

    return result.rows;
  }
}
