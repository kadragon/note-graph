// Trace: SPEC-stats-1, TASK-047
/**
 * Statistics repository for work note completion metrics
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  WorkNoteWithStats,
  WorkNoteStatistics,
  CategoryDistribution,
  PersonDistribution,
  DepartmentDistribution,
} from '../types/statistics';

interface FindCompletedWorkNotesOptions {
  personId?: string;
  deptName?: string;
  categoryId?: string;
}

export class StatisticsRepository {
  constructor(private db: D1Database) {}

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

    // Date range filter on work note creation date
    conditions.push(`wn.created_at >= ?`);
    bindings.push(startDate);
    conditions.push(`wn.created_at <= ?`);
    bindings.push(endDate + 'T23:59:59.999Z'); // End of day

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
      query += ` WHERE ` + conditions.join(' AND ');
    }

    // Order by creation date descending
    query += ` ORDER BY wn.created_at DESC`;

    const result = await this.db.prepare(query).bind(...bindings).all<WorkNoteWithStats>();

    const workNotes = result.results || [];

    // Fetch assigned persons for each work note
    for (const workNote of workNotes) {
      const personsResult = await this.db
        .prepare(
          `SELECT
            wnp.person_id as personId,
            p.name as personName,
            p.current_dept as currentDept,
            wnp.role
           FROM work_note_person wnp
           INNER JOIN persons p ON wnp.person_id = p.person_id
           WHERE wnp.work_id = ?`
        )
        .bind(workNote.workId)
        .all<{ personId: string; personName: string; currentDept: string | null; role: 'OWNER' | 'RELATED' }>();

      workNote.assignedPersons = personsResult.results || [];
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

    // Calculate summary metrics
    const totalWorkNotes = workNotes.length;
    const totalCompletedTodos = workNotes.reduce((sum, wn) => sum + wn.completedTodoCount, 0);
    const totalTodos = workNotes.reduce((sum, wn) => sum + wn.totalTodoCount, 0);
    const completionRate = totalTodos > 0 ? (totalCompletedTodos / totalTodos) * 100 : 0;

    // Calculate category distribution
    const categoryMap = new Map<string | null, number>();
    for (const workNote of workNotes) {
      const categoryResult = await this.db
        .prepare(
          `SELECT tc.category_id as categoryId
           FROM work_note_task_category wntc
           INNER JOIN task_categories tc ON wntc.category_id = tc.category_id
           WHERE wntc.work_id = ?
           LIMIT 1`
        )
        .bind(workNote.workId)
        .first<{ categoryId: string }>();

      const categoryId = categoryResult?.categoryId || null;
      categoryMap.set(categoryId, (categoryMap.get(categoryId) || 0) + 1);
    }

    const byCategory: CategoryDistribution[] = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count,
    }));

    // Calculate person distribution
    const personMap = new Map<string, { personName: string; currentDept: string | null; count: number }>();
    for (const workNote of workNotes) {
      for (const person of workNote.assignedPersons) {
        if (person.role === 'OWNER') {
          const existing = personMap.get(person.personId);
          if (existing) {
            existing.count += 1;
          } else {
            personMap.set(person.personId, {
              personName: person.personName,
              currentDept: person.currentDept,
              count: 1,
            });
          }
        }
      }
    }

    const byPerson: PersonDistribution[] = Array.from(personMap.entries()).map(([personId, data]) => ({
      personId,
      personName: data.personName,
      currentDept: data.currentDept,
      count: data.count,
    }));

    // Calculate department distribution
    const deptMap = new Map<string | null, number>();
    for (const workNote of workNotes) {
      for (const person of workNote.assignedPersons) {
        if (person.role === 'OWNER') {
          const deptName = person.currentDept;
          deptMap.set(deptName, (deptMap.get(deptName) || 0) + 1);
        }
      }
    }

    const byDepartment: DepartmentDistribution[] = Array.from(deptMap.entries()).map(([deptName, count]) => ({
      deptName,
      count,
    }));

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
