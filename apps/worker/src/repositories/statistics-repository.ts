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

    let paramIndex = 1;
    let filterJoins = '';
    const conditions: string[] = [];
    const bindings: (string | number)[] = [];

    bindings.push(startDateTime, endDateTime);
    paramIndex = 3;

    if (personId) {
      filterJoins += ` INNER JOIN work_note_person wnp ON wn.work_id = wnp.work_id`;
      conditions.push(`wnp.person_id = $${paramIndex++}`);
      bindings.push(personId);
    }

    if (deptName) {
      if (!personId) {
        filterJoins += ` INNER JOIN work_note_person wnp ON wn.work_id = wnp.work_id`;
      }
      filterJoins += ` INNER JOIN persons p ON wnp.person_id = p.person_id`;
      conditions.push(`p.current_dept = $${paramIndex++}`);
      bindings.push(deptName);
    }

    if (categoryId) {
      filterJoins += ` INNER JOIN work_note_task_category wntc ON wn.work_id = wntc.work_id`;
      conditions.push(`wntc.category_id = $${paramIndex++}`);
      bindings.push(categoryId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      WITH PeriodTodos AS (
        SELECT
          work_id,
          SUM(CASE WHEN status = '완료' THEN 1 ELSE 0 END) as completed_in_period,
          COUNT(*) as total_in_period,
          MAX(updated_at) as last_updated
        FROM todos
        WHERE updated_at >= $1 AND updated_at <= $2
        GROUP BY work_id
        HAVING SUM(CASE WHEN status = '완료' THEN 1 ELSE 0 END) > 0
      )
      SELECT DISTINCT
        wn.work_id as "workId",
        wn.title,
        wn.content_raw as "contentRaw",
        wn.category,
        wn.created_at as "createdAt",
        wn.updated_at as "updatedAt",
        wn.embedded_at as "embeddedAt",
        pt.completed_in_period as "completedTodoCount",
        pt.total_in_period as "totalTodoCount",
        pt.last_updated as "lastUpdated",
        COALESCE(ap.data, '[]'::jsonb) as "assignedPersons",
        COALESCE(cats.data, '[]'::jsonb) as "categories"
      FROM work_notes wn
      INNER JOIN PeriodTodos pt ON wn.work_id = pt.work_id
      ${filterJoins}
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'workId', wnp2.work_id, 'personId', wnp2.person_id,
          'personName', p2.name, 'currentDept', p2.current_dept,
          'role', wnp2.role
        )) as data
        FROM work_note_person wnp2
        JOIN persons p2 ON wnp2.person_id = p2.person_id
        WHERE wnp2.work_id = wn.work_id
      ) ap ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'categoryId', tc.category_id,
          'categoryName', tc.name
        )) as data
        FROM work_note_task_category wntc2
        JOIN task_categories tc ON wntc2.category_id = tc.category_id
        WHERE wntc2.work_id = wn.work_id
      ) cats ON true
      ${whereClause}
      ORDER BY pt.last_updated DESC
    `;

    const result = await this.db.query<
      WorkNoteWithStats & {
        assignedPersons: AssignedPersonDetail[] | null;
        categories: Array<{ categoryId: string; categoryName: string }> | null;
      }
    >(query, bindings);

    return result.rows.map((wn) => ({
      ...wn,
      completedTodoCount: Number(wn.completedTodoCount),
      totalTodoCount: Number(wn.totalTodoCount),
      assignedPersons: wn.assignedPersons || [],
      categories: wn.categories || [],
    }));
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

    const totalWorkNotes = workNotes.length;
    const totalCompletedTodos = workNotes.reduce((sum, wn) => sum + wn.completedTodoCount, 0);
    const totalTodos = workNotes.reduce((sum, wn) => sum + wn.totalTodoCount, 0);
    const completionRate = totalTodos > 0 ? (totalCompletedTodos / totalTodos) * 100 : 0;

    const categoryMap = new Map<string | null, number>();
    const categoryNameById = new Map<string | null, string | null>();

    for (const workNote of workNotes) {
      const cats = (
        workNote as unknown as { categories: Array<{ categoryId: string; categoryName: string }> }
      ).categories;
      const firstCat = cats?.[0] || null;
      const categoryId = firstCat?.categoryId || null;
      const categoryName = firstCat?.categoryName || null;

      workNote.categoryName = categoryName;
      categoryMap.set(categoryId, (categoryMap.get(categoryId) || 0) + 1);

      if (firstCat && !categoryNameById.has(firstCat.categoryId)) {
        categoryNameById.set(firstCat.categoryId, firstCat.categoryName);
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
