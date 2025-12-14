// Trace: SPEC-project-1, TASK-036, TASK-065
/**
 * Repository for Project entity operations
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  CreateProjectData,
  Project,
  ProjectDetail,
  ProjectFile,
  ProjectFilters,
  ProjectParticipant,
  ProjectParticipantRole,
  ProjectStats,
  ProjectWorkNote,
  UpdateProjectData,
} from '@shared/types/project';
import { nanoid } from 'nanoid';
import { ConflictError, NotFoundError } from '../types/errors';

export class ProjectRepository {
  constructor(private db: D1Database) {}

  /**
   * Find project by ID
   */
  async findById(projectId: string): Promise<Project | null> {
    const result = await this.db
      .prepare(
        `
      SELECT * FROM projects
      WHERE project_id = ? AND deleted_at IS NULL
    `
      )
      .bind(projectId)
      .first<Record<string, unknown>>();

    if (!result) return null;

    return this.mapDbToProject(result);
  }

  /**
   * Find all projects with optional filters
   */
  async findAll(filters: ProjectFilters = {}): Promise<Project[]> {
    let query = 'SELECT * FROM projects';
    const conditions: string[] = [];
    const bindings: (string | number)[] = [];

    // Soft delete filter (default: exclude deleted)
    if (!filters.includeDeleted) {
      conditions.push('deleted_at IS NULL');
    }

    // Status filter
    if (filters.status) {
      conditions.push('status = ?');
      bindings.push(filters.status);
    }

    // Leader filter
    if (filters.leaderPersonId) {
      conditions.push('leader_person_id = ?');
      bindings.push(filters.leaderPersonId);
    }

    // Department filter
    if (filters.deptName) {
      conditions.push('dept_name = ?');
      bindings.push(filters.deptName);
    }

    // Participant filter (requires join)
    if (filters.participantPersonId) {
      query = `
        SELECT DISTINCT p.* FROM projects p
        INNER JOIN project_participants pp ON p.project_id = pp.project_id
      `;
      conditions.push('pp.person_id = ?');
      bindings.push(filters.participantPersonId);
    }

    // Date range filters
    if (filters.startDateFrom) {
      conditions.push('start_date >= ?');
      bindings.push(filters.startDateFrom);
    }
    if (filters.startDateTo) {
      conditions.push('start_date <= ?');
      bindings.push(filters.startDateTo);
    }
    if (filters.targetEndDateFrom) {
      conditions.push('target_end_date >= ?');
      bindings.push(filters.targetEndDateFrom);
    }
    if (filters.targetEndDateTo) {
      conditions.push('target_end_date <= ?');
      bindings.push(filters.targetEndDateTo);
    }

    // Build final query
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ' ORDER BY created_at DESC';

    const results = await this.db
      .prepare(query)
      .bind(...bindings)
      .all<Record<string, unknown>>();

    return (results.results || []).map((r) => this.mapDbToProject(r));
  }

  /**
   * Get project detail with associations
   */
  async getDetail(projectId: string): Promise<ProjectDetail | null> {
    const project = await this.findById(projectId);
    if (!project) return null;

    const [participants, workNotes, files, stats] = await Promise.all([
      this.getParticipants(projectId),
      this.getWorkNotes(projectId),
      this.getFiles(projectId),
      this.getStatistics(projectId),
    ]);

    return {
      ...project,
      participants,
      workNotes,
      files,
      stats,
    };
  }

  /**
   * Create a new project
   */
  async create(data: CreateProjectData): Promise<Project> {
    const projectId = `PROJECT-${nanoid()}`;
    const now = new Date().toISOString();
    const status = data.status || '진행중';

    const statements: D1PreparedStatement[] = [
      // Insert project
      this.db
        .prepare(
          `
        INSERT INTO projects (
          project_id, name, description, status, tags, priority,
          start_date, target_end_date, leader_person_id, dept_name,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(
          projectId,
          data.name,
          data.description || null,
          status,
          data.tags || null,
          data.priority || null,
          data.startDate || null,
          data.targetEndDate || null,
          data.leaderPersonId || null,
          data.deptName || null,
          now,
          now
        ),
    ];

    // Add participants if provided
    if (data.participantPersonIds && data.participantPersonIds.length > 0) {
      for (const personId of data.participantPersonIds) {
        statements.push(
          this.db
            .prepare(
              `
            INSERT INTO project_participants (project_id, person_id, role, joined_at)
            VALUES (?, ?, ?, ?)
          `
            )
            .bind(projectId, personId, '참여자', now)
        );
      }
    }

    // Execute all statements in batch (atomic)
    await this.db.batch(statements);

    const created = await this.findById(projectId);
    if (!created) {
      throw new Error('Failed to create project');
    }

    return created;
  }

  /**
   * Update an existing project
   */
  async update(projectId: string, data: UpdateProjectData): Promise<Project> {
    const existing = await this.findById(projectId);
    if (!existing) {
      throw new NotFoundError('Project', projectId);
    }

    const updates: string[] = [];
    const bindings: (string | null)[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      bindings.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      bindings.push(data.description);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      bindings.push(data.status);
    }
    if (data.tags !== undefined) {
      updates.push('tags = ?');
      bindings.push(data.tags);
    }
    if (data.priority !== undefined) {
      updates.push('priority = ?');
      bindings.push(data.priority);
    }
    if (data.startDate !== undefined) {
      updates.push('start_date = ?');
      bindings.push(data.startDate);
    }
    if (data.targetEndDate !== undefined) {
      updates.push('target_end_date = ?');
      bindings.push(data.targetEndDate);
    }
    if (data.actualEndDate !== undefined) {
      updates.push('actual_end_date = ?');
      bindings.push(data.actualEndDate);
    }
    if (data.leaderPersonId !== undefined) {
      updates.push('leader_person_id = ?');
      bindings.push(data.leaderPersonId);
    }
    if (data.deptName !== undefined) {
      updates.push('dept_name = ?');
      bindings.push(data.deptName);
    }

    if (updates.length === 0) {
      return existing; // No changes
    }

    updates.push('updated_at = ?');
    bindings.push(new Date().toISOString());

    bindings.push(projectId); // WHERE clause

    const query = `
      UPDATE projects
      SET ${updates.join(', ')}
      WHERE project_id = ? AND deleted_at IS NULL
    `;

    await this.db
      .prepare(query)
      .bind(...bindings)
      .run();

    const updated = await this.findById(projectId);
    if (!updated) {
      throw new Error('Failed to update project');
    }

    return updated;
  }

  /**
   * Soft delete a project
   */
  async delete(projectId: string): Promise<void> {
    const existing = await this.findById(projectId);
    if (!existing) {
      throw new NotFoundError('Project', projectId);
    }

    const now = new Date().toISOString();

    // Soft delete the project and detach associations so work notes can be re-assigned.
    // This mirrors the intended behavior of ON DELETE CASCADE / SET NULL for a soft-delete.
    await this.db.batch([
      this.db
        .prepare(
          `
        UPDATE projects
        SET deleted_at = ?
        WHERE project_id = ? AND deleted_at IS NULL
      `
        )
        .bind(now, projectId),
      this.db.prepare(`DELETE FROM project_work_notes WHERE project_id = ?`).bind(projectId),
      this.db
        .prepare(`UPDATE work_notes SET project_id = NULL WHERE project_id = ?`)
        .bind(projectId),
    ]);
  }

  /**
   * Get project participants
   */
  async getParticipants(projectId: string): Promise<ProjectParticipant[]> {
    const results = await this.db
      .prepare(
        `
      SELECT
        pp.*,
        p.name AS person_name,
        p.current_dept AS current_dept
      FROM project_participants pp
      INNER JOIN persons p ON pp.person_id = p.person_id
      WHERE pp.project_id = ?
      ORDER BY pp.joined_at ASC
    `
      )
      .bind(projectId)
      .all<Record<string, unknown>>();

    return (results.results || []).map((r) => ({
      id: r.id as number,
      projectId: r.project_id as string,
      personId: r.person_id as string,
      role: r.role as ProjectParticipantRole,
      joinedAt: r.joined_at as string,
      personName: r.person_name as string,
      currentDept: (r.current_dept as string) || null,
    }));
  }

  /**
   * Add participant to project
   */
  async addParticipant(
    projectId: string,
    personId: string,
    role: string = '참여자'
  ): Promise<void> {
    const now = new Date().toISOString();

    try {
      await this.db
        .prepare(
          `
        INSERT INTO project_participants (project_id, person_id, role, joined_at)
        VALUES (?, ?, ?, ?)
      `
        )
        .bind(projectId, personId, role, now)
        .run();
    } catch (error) {
      // Duplicate participant
      if (error instanceof Error && error.message.includes('UNIQUE')) {
        throw new ConflictError('Person already participant in this project');
      }
      throw error;
    }
  }

  /**
   * Remove participant from project
   */
  async removeParticipant(projectId: string, personId: string): Promise<void> {
    await this.db
      .prepare(
        `
      DELETE FROM project_participants
      WHERE project_id = ? AND person_id = ?
    `
      )
      .bind(projectId, personId)
      .run();
  }

  /**
   * Get project work notes
   */
  async getWorkNotes(projectId: string): Promise<ProjectWorkNote[]> {
    const results = await this.db
      .prepare(
        `
      SELECT
        pwn.*,
        wn.title AS work_title,
        wn.category AS work_category
      FROM project_work_notes pwn
      INNER JOIN work_notes wn ON pwn.work_id = wn.work_id
      WHERE pwn.project_id = ?
      ORDER BY pwn.assigned_at DESC
    `
      )
      .bind(projectId)
      .all<Record<string, unknown>>();

    return (results.results || []).map((r) => ({
      id: r.id as number,
      projectId: r.project_id as string,
      workId: r.work_id as string,
      assignedAt: r.assigned_at as string,
      workTitle: r.work_title as string,
      workCategory: (r.work_category as string) || null,
    }));
  }

  /**
   * Get project files (active only)
   */
  async getFiles(projectId: string): Promise<ProjectFile[]> {
    const results = await this.db
      .prepare(
        `
      SELECT * FROM project_files
      WHERE project_id = ? AND deleted_at IS NULL
      ORDER BY uploaded_at DESC
    `
      )
      .bind(projectId)
      .all<Record<string, unknown>>();

    return (results.results || []).map((r) => ({
      fileId: r.file_id as string,
      projectId: r.project_id as string,
      r2Key: r.r2_key as string,
      originalName: r.original_name as string,
      fileType: r.file_type as string,
      fileSize: r.file_size as number,
      uploadedBy: r.uploaded_by as string,
      uploadedAt: r.uploaded_at as string,
      embeddedAt: (r.embedded_at as string) || null,
      deletedAt: (r.deleted_at as string) || null,
    }));
  }

  /**
   * Get project statistics
   */
  async getStatistics(projectId: string): Promise<ProjectStats> {
    const [workNotesCount, todoStats, fileStats, lastActivity] = await Promise.all([
      // Total work notes
      this.db
        .prepare(
          `
        SELECT COUNT(*) as count FROM project_work_notes
        WHERE project_id = ?
      `
        )
        .bind(projectId)
        .first<{ count: number }>(),

      // Todo statistics
      this.db
        .prepare(
          `
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = '완료' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = '진행중' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = '보류' THEN 1 ELSE 0 END) as on_hold
        FROM todos t
        INNER JOIN project_work_notes pwn ON t.work_id = pwn.work_id
        WHERE pwn.project_id = ?
      `
        )
        .bind(projectId)
        .first<{
          total: number;
          completed: number;
          pending: number;
          on_hold: number;
        }>(),

      // File statistics
      this.db
        .prepare(
          `
        SELECT
          COUNT(*) as count,
          COALESCE(SUM(file_size), 0) as total_size
        FROM project_files
        WHERE project_id = ? AND deleted_at IS NULL
      `
        )
        .bind(projectId)
        .first<{ count: number; total_size: number }>(),

      // Last activity (most recent work note update)
      this.db
        .prepare(
          `
        SELECT wn.updated_at
        FROM work_notes wn
        INNER JOIN project_work_notes pwn ON wn.work_id = pwn.work_id
        WHERE pwn.project_id = ?
        ORDER BY wn.updated_at DESC
        LIMIT 1
      `
        )
        .bind(projectId)
        .first<{ updated_at: string }>(),
    ]);

    return {
      projectId,
      totalWorkNotes: workNotesCount?.count || 0,
      totalTodos: todoStats?.total || 0,
      completedTodos: todoStats?.completed || 0,
      pendingTodos: todoStats?.pending || 0,
      onHoldTodos: todoStats?.on_hold || 0,
      totalFiles: fileStats?.count || 0,
      totalFileSize: fileStats?.total_size || 0,
      lastActivity: lastActivity?.updated_at || null,
    };
  }

  /**
   * Map database row to Project type (handle snake_case to camelCase)
   */
  private mapDbToProject(row: Record<string, unknown>): Project {
    return {
      projectId: row.project_id as string,
      name: row.name as string,
      description: (row.description as string) || null,
      status: row.status as Project['status'],
      tags: (row.tags as string) || null,
      priority: (row.priority as Project['priority']) || null,
      startDate: (row.start_date as string) || null,
      targetEndDate: (row.target_end_date as string) || null,
      actualEndDate: (row.actual_end_date as string) || null,
      leaderPersonId: (row.leader_person_id as string) || null,
      deptName: (row.dept_name as string) || null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      deletedAt: (row.deleted_at as string) || null,
    };
  }
}
