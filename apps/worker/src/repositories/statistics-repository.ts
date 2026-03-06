// Trace: SPEC-stats-1, TASK-047, TASK-050, TASK-054
/**
 * Statistics repository for work note completion metrics
 */

import type {
  CategoryDistribution,
  DepartmentDistribution,
  PersonDistribution,
  WorkNoteStatistics,
  WorkNoteWithStats,
} from '@shared/types/statistics';
import type { DatabaseClient } from '../types/database';
import { queryInChunks } from '../utils/db-utils';

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
  constructor(private db: DatabaseClient) {}

  /**
   * Helper: Extract owners from work notes
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
   */
  async findCompletedWorkNotes(
    startDate: string,
    endDate: string,
    options: FindCompletedWorkNotesOptions = {}
  ): Promise<WorkNoteWithStats[]> {
    const { personId, deptName, categoryId } = options;

    const startDateTime = `${startDate}T00:00:00.000Z`;
    const endDateTime = `${endDate}T23:59:59.999Z`;

    let query = `
      WITH PeriodTodos AS (
        SELECT
          work_id,
          SUM(CASE WHEN status = '완료' THEN 1 ELSE 0 END) as completed_in_period,
          COUNT(*) as total_in_period,
          MAX(updated_at) as last_updated
        FROM todos
        WHERE updated_at >= ? AND updated_at <= ?
        GROUP BY work_id
        HAVING SUM(CASE WHEN status = '완료' THEN 1 ELSE 0 END) > 0
      )
      SELECT DISTINCT
        wn.work_id as workId,
        wn.title,
        wn.content_raw as contentRaw,
        wn.category,
        wn.created_at as createdAt,
        wn.updated_at as updatedAt,
        wn.embedded_at as embeddedAt,
        pt.completed_in_period as completedTodoCount,
        pt.total_in_period as totalTodoCount
      FROM work_notes wn
      INNER JOIN PeriodTodos pt ON wn.work_id = pt.work_id
    `;

    const conditions: string[] = [];
    const bindings: (string | number)[] = [];

    // Bind date parameters for CTE
    bindings.push(startDateTime, endDateTime);

    if (personId) {
      query += ` INNER JOIN work_note_person wnp ON wn.work_id = wnp.work_id`;
      conditions.push(`wnp.person_id = ?`);
      bindings.push(personId);
    }

    if (deptName) {
      if (!personId) {
        query += ` INNER JOIN work_note_person wnp ON wn.work_id = wnp.work_id`;
      }
      query += ` INNER JOIN persons p ON wnp.person_id = p.person_id`;
      conditions.push(`p.current_dept = ?`);
      bindings.push(deptName);
    }

    if (categoryId) {
      query += ` INNER JOIN work_note_task_category wntc ON wn.work_id = wntc.work_id`;
      conditions.push(`wntc.category_id = ?`);
      bindings.push(categoryId);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY pt.last_updated DESC`;

    const result = await this.db.query<WorkNoteWithStats>(query, bindings);
    const workNotes = result.rows;

    // Batch fetch assigned persons for all work notes
    const workNoteIds = workNotes.map((wn) => wn.workId);
    if (workNoteIds.length === 0) {
      return workNotes;
    }

    const personsRows = await queryInChunks(
      this.db,
      workNoteIds,
      async (db, chunk, placeholders) => {
        const r = await db.query<AssignedPersonDetail>(
          `SELECT
          wnp.work_id as workId,
          wnp.person_id as personId,
          p.name as personName,
          p.current_dept as currentDept,
          wnp.role
         FROM work_note_person wnp
         INNER JOIN persons p ON wnp.person_id = p.person_id
         WHERE wnp.work_id IN (${placeholders})`,
          chunk
        );
        return r.rows;
      }
    );

    // Map persons back to work notes
    const personsByWorkId = new Map<string, AssignedPersonDetail[]>();
    for (const person of personsRows) {
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
    const workNotes = await this.findCompletedWorkNotes(startDate, endDate, options);

    for (const workNote of workNotes) {
      workNote.categoryName = null;
    }

    const totalWorkNotes = workNotes.length;
    const totalCompletedTodos = workNotes.reduce((sum, wn) => sum + wn.completedTodoCount, 0);
    const totalTodos = workNotes.reduce((sum, wn) => sum + wn.totalTodoCount, 0);
    const completionRate = totalTodos > 0 ? (totalCompletedTodos / totalTodos) * 100 : 0;

    const categoryMap = new Map<string | null, number>();
    const categoryNameById = new Map<string | null, string | null>();
    const workNoteIds = workNotes.map((wn) => wn.workId);

    if (workNoteIds.length > 0) {
      const categoriesRows = await queryInChunks(
        this.db,
        workNoteIds,
        async (db, chunk, placeholders) => {
          const r = await db.query<{
            workId: string;
            categoryId: string;
            categoryName: string;
          }>(
            `SELECT
            wntc.work_id as workId,
            tc.category_id as categoryId,
            tc.name as categoryName
           FROM work_note_task_category wntc
           INNER JOIN task_categories tc ON wntc.category_id = tc.category_id
           WHERE wntc.work_id IN (${placeholders})`,
            chunk
          );
          return r.rows;
        }
      );

      const categoryByWorkId = new Map<string, { categoryId: string; categoryName: string }>();
      for (const row of categoriesRows) {
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

      for (const workNote of workNotes) {
        const categoryInfo = categoryByWorkId.get(workNote.workId);
        const categoryId = categoryInfo?.categoryId || null;
        const categoryName = categoryInfo?.categoryName || null;

        workNote.categoryName = categoryName;
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
        completionRate: Math.round(completionRate * 100) / 100,
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
