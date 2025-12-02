// Trace: SPEC-stats-1, TASK-047, TASK-050, TASK-054
/**
 * Statistics repository for work note completion metrics
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  CategoryDistribution,
  DepartmentDistribution,
  PersonDistribution,
  WorkNoteStatistics,
  WorkNoteWithStats,
} from '../types/statistics';

interface FindCompletedWorkNotesOptions {
  personId?: string;
  deptName?: string;
  categoryId?: string;
}

interface AssignedPersonDetail {
  workId: string;
  personId: string;
  personName: string;
  currentDept: string | null;
  role: 'OWNER' | 'RELATED';
}

export class StatisticsRepository {
  constructor(private db: D1Database) {}

  /**
   * Helper: Extract owners from work notes
   * Reduces code duplication between person and department distribution calculations
   */
  private getOwnersFromWorkNotes(workNotes: WorkNoteWithStats[]): Array<{
    personId: string;
    personName: string;
    currentDept: string | null;
  }> {
    const owners: Array<{
      personId: string;
      personName: string;
      currentDept: string | null;
    }> = [];

    for (const workNote of workNotes) {
      for (const person of workNote.assignedPersons) {
        if (person.role === 'OWNER') {
          owners.push({
            personId: person.personId,
            personName: person.personName,
            currentDept: person.currentDept,
          });
        }
      }
    }

    return owners;
  }

  /**
   * Find work notes with at least one completed todo within date range
   * Supports filtering by person, department, and category
   */
  async findCompletedWorkNotes(
    startDate: string,
    endDate: string,
    options: FindCompletedWorkNotesOptions = {}
  ): Promise<WorkNoteWithStats[]> {
    const { personId, deptName, categoryId } = options;

    const startDateTime = `${startDate}T00:00:00.000Z`;
    const endDateTime = `${endDate}T23:59:59.999Z`;

    // Build base query to find work notes with completed todos
    let query = `
      SELECT DISTINCT
        wn.work_id as workId,
        wn.title,
        wn.content_raw as contentRaw,
        wn.category,
        wn.project_id as projectId,
        wn.created_at as createdAt,
        wn.updated_at as updatedAt,
        wn.embedded_at as embeddedAt,
        (SELECT COUNT(*) FROM todos t WHERE t.work_id = wn.work_id AND t.status = '완료') as completedTodoCount,
        (SELECT COUNT(*) FROM todos t WHERE t.work_id = wn.work_id) as totalTodoCount
      FROM work_notes wn
      INNER JOIN todos td ON wn.work_id = td.work_id
    `;

    const conditions: string[] = [];
    const bindings: (string | number)[] = [];

    // Must have at least one completed todo
    conditions.push(`td.status = '완료'`);

    // Date range filter on todo completion timestamp (updated_at)
    conditions.push(`td.updated_at >= ?`);
    bindings.push(startDateTime);
    conditions.push(`td.updated_at <= ?`);
    bindings.push(endDateTime);

    // Person filter
    if (personId) {
      query += ` INNER JOIN work_note_person wnp ON wn.work_id = wnp.work_id`;
      conditions.push(`wnp.person_id = ?`);
      bindings.push(personId);
    }

    // Department filter
    if (deptName) {
      if (!personId) {
        query += ` INNER JOIN work_note_person wnp ON wn.work_id = wnp.work_id`;
      }
      query += ` INNER JOIN persons p ON wnp.person_id = p.person_id`;
      conditions.push(`p.current_dept = ?`);
      bindings.push(deptName);
    }

    // Category filter
    if (categoryId) {
      query += ` INNER JOIN work_note_task_category wntc ON wn.work_id = wntc.work_id`;
      conditions.push(`wntc.category_id = ?`);
      bindings.push(categoryId);
    }

    // Add WHERE clause
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Order by completion timestamp descending
    query += ` ORDER BY td.updated_at DESC`;

    const result = await this.db
      .prepare(query)
      .bind(...bindings)
      .all<WorkNoteWithStats>();

    const workNotes = result.results || [];

    // Batch fetch assigned persons for all work notes to avoid N+1 query problem
    const workNoteIds = workNotes.map((wn) => wn.workId);
    if (workNoteIds.length === 0) {
      return workNotes;
    }

    const personsResult = await this.db
      .prepare(
        `SELECT
          wnp.work_id as workId,
          wnp.person_id as personId,
          p.name as personName,
          p.current_dept as currentDept,
          wnp.role
         FROM work_note_person wnp
         INNER JOIN persons p ON wnp.person_id = p.person_id
         WHERE wnp.work_id IN (${workNoteIds.map(() => '?').join(',')})`
      )
      .bind(...workNoteIds)
      .all<AssignedPersonDetail>();

    // Map persons back to work notes
    const personsByWorkId = new Map<string, AssignedPersonDetail[]>();
    for (const person of personsResult.results || []) {
      const persons = personsByWorkId.get(person.workId) || [];
      persons.push({
        workId: person.workId,
        personId: person.personId,
        personName: person.personName,
        currentDept: person.currentDept,
        role: person.role,
      });
      personsByWorkId.set(person.workId, persons);
    }

    for (const workNote of workNotes) {
      workNote.assignedPersons = personsByWorkId.get(workNote.workId) || [];
    }

    return workNotes;
  }

  /**
   * Calculate comprehensive statistics for work notes with completed todos
   */
  async calculateStatistics(
    startDate: string,
    endDate: string,
    options: FindCompletedWorkNotesOptions = {}
  ): Promise<WorkNoteStatistics> {
    // Get all completed work notes
    const workNotes = await this.findCompletedWorkNotes(startDate, endDate, options);

    // Default category name to null for all work notes
    for (const workNote of workNotes) {
      workNote.categoryName = null;
    }

    // Calculate summary metrics
    const totalWorkNotes = workNotes.length;
    const totalCompletedTodos = workNotes.reduce((sum, wn) => sum + wn.completedTodoCount, 0);
    const totalTodos = workNotes.reduce((sum, wn) => sum + wn.totalTodoCount, 0);
    const completionRate = totalTodos > 0 ? (totalCompletedTodos / totalTodos) * 100 : 0;

    // Calculate category distribution
    // Batch fetch categories for all work notes to avoid N+1 query problem
    const categoryMap = new Map<string | null, number>();
    const categoryNameById = new Map<string | null, string | null>();
    const workNoteIds = workNotes.map((wn) => wn.workId);

    if (workNoteIds.length > 0) {
      const categoriesResult = await this.db
        .prepare(
          `SELECT
            wntc.work_id as workId,
            tc.category_id as categoryId,
            tc.name as categoryName
           FROM work_note_task_category wntc
           INNER JOIN task_categories tc ON wntc.category_id = tc.category_id
           WHERE wntc.work_id IN (${workNoteIds.map(() => '?').join(',')})`
        )
        .bind(...workNoteIds)
        .all<{ workId: string; categoryId: string; categoryName: string }>();

      // Build category map from work notes
      const categoryByWorkId = new Map<string, { categoryId: string; categoryName: string }>();
      for (const row of categoriesResult.results || []) {
        if (!categoryByWorkId.has(row.workId)) {
          categoryByWorkId.set(row.workId, {
            categoryId: row.categoryId,
            categoryName: row.categoryName,
          });
        }
        if (!categoryNameById.has(row.categoryId)) {
          categoryNameById.set(row.categoryId, row.categoryName);
        }
      }

      // Count categories and attach category names to work notes
      // Note: workNote.category comes from work_notes table, categoryName from task_categories join
      for (const workNote of workNotes) {
        const categoryInfo = categoryByWorkId.get(workNote.workId);
        const categoryId = categoryInfo?.categoryId || null;
        const categoryName = categoryInfo?.categoryName || null;

        // Attach human-readable category name for UI display
        workNote.categoryName = categoryName;

        // Count distribution by categoryId (not by work_notes.category field)
        categoryMap.set(categoryId, (categoryMap.get(categoryId) || 0) + 1);
      }
    }

    const byCategory: CategoryDistribution[] = Array.from(categoryMap.entries()).map(
      ([categoryId, count]) => ({
        categoryId,
        categoryName: categoryNameById.get(categoryId) ?? null,
        count,
      })
    );

    // Calculate person distribution using helper
    const owners = this.getOwnersFromWorkNotes(workNotes);

    const personMap = new Map<
      string,
      { personName: string; currentDept: string | null; count: number }
    >();
    for (const owner of owners) {
      const existing = personMap.get(owner.personId);
      if (existing) {
        existing.count += 1;
      } else {
        personMap.set(owner.personId, {
          personName: owner.personName,
          currentDept: owner.currentDept,
          count: 1,
        });
      }
    }

    const byPerson: PersonDistribution[] = Array.from(personMap.entries()).map(
      ([personId, data]) => ({
        personId,
        personName: data.personName,
        currentDept: data.currentDept,
        count: data.count,
      })
    );

    // Calculate department distribution using helper
    const deptMap = new Map<string | null, number>();
    for (const owner of owners) {
      const deptName = owner.currentDept;
      deptMap.set(deptName, (deptMap.get(deptName) || 0) + 1);
    }

    const byDepartment: DepartmentDistribution[] = Array.from(deptMap.entries()).map(
      ([deptName, count]) => ({
        deptName,
        count,
      })
    );

    return {
      summary: {
        totalWorkNotes,
        totalCompletedTodos,
        totalTodos,
        completionRate: Math.round(completionRate * 100) / 100, // Round to 2 decimal places
      },
      distributions: {
        byCategory,
        byPerson,
        byDepartment,
      },
      workNotes,
    };
  }
}
