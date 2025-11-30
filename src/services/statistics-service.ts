// Trace: SPEC-stats-1, TASK-047, TASK-050
/**
 * Statistics service for work note metrics with period calculations
 */

import { StatisticsRepository } from '../repositories/statistics-repository';
import type { StatisticsPeriod } from '../schemas/statistics';
import type { Env } from '../types/env';
import type { StatisticsDateRange, WorkNoteStatistics } from '../types/statistics';

export class StatisticsService {
  private repository: StatisticsRepository;

  constructor(env: Env) {
    this.repository = new StatisticsRepository(env.DB);
  }

  /**
   * Calculate date range for given period and optional year
   */
  calculateDateRange(period: StatisticsPeriod, year?: number): StatisticsDateRange {
    const now = new Date();
    const currentYear = year || now.getFullYear();

    switch (period) {
      case 'this-week': {
        // Current week (Monday to Sunday)
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days; otherwise go to Monday
        const monday = new Date(now);
        monday.setDate(now.getDate() + mondayOffset);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        return {
          startDate: monday.toISOString().split('T')[0] as string,
          endDate: sunday.toISOString().split('T')[0] as string,
        };
      }

      case 'this-month': {
        // Current month
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        return {
          startDate: firstDay.toISOString().split('T')[0] as string,
          endDate: lastDay.toISOString().split('T')[0] as string,
        };
      }

      case 'first-half': {
        // January 1 to June 30 of specified or current year
        return {
          startDate: `${currentYear}-01-01`,
          endDate: `${currentYear}-06-30`,
        };
      }

      case 'second-half': {
        // July 1 to December 31 of specified or current year
        return {
          startDate: `${currentYear}-07-01`,
          endDate: `${currentYear}-12-31`,
        };
      }

      case 'this-year': {
        // January 1 to December 31 of selected or current year
        const actualYear = currentYear;
        return {
          startDate: `${actualYear}-01-01`,
          endDate: `${actualYear}-12-31`,
        };
      }

      case 'last-week': {
        // Last complete week (Monday to Sunday)
        const dayOfWeek = now.getDay();
        const lastSundayOffset = dayOfWeek === 0 ? -7 : -dayOfWeek; // Go to last Sunday
        const lastSunday = new Date(now);
        lastSunday.setDate(now.getDate() + lastSundayOffset);
        lastSunday.setHours(0, 0, 0, 0);

        const lastMonday = new Date(lastSunday);
        lastMonday.setDate(lastSunday.getDate() - 6);

        return {
          startDate: lastMonday.toISOString().split('T')[0] as string,
          endDate: lastSunday.toISOString().split('T')[0] as string,
        };
      }

      case 'custom': {
        // Custom range should be provided by caller, this should not be reached
        throw new Error('Custom period requires explicit startDate and endDate');
      }

      default: {
        // Default to this week
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(now);
        monday.setDate(now.getDate() + mondayOffset);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        return {
          startDate: monday.toISOString().split('T')[0] as string,
          endDate: sunday.toISOString().split('T')[0] as string,
        };
      }
    }
  }

  /**
   * Get statistics for specified period with optional filters
   */
  async getStatistics(
    period: StatisticsPeriod,
    options: {
      year?: number;
      startDate?: string;
      endDate?: string;
      personId?: string;
      deptName?: string;
      categoryId?: string;
    } = {}
  ): Promise<WorkNoteStatistics> {
    const { year, startDate, endDate, personId, deptName, categoryId } = options;

    // Calculate date range
    let dateRange: StatisticsDateRange;
    if (period === 'custom') {
      if (!startDate || !endDate) {
        throw new Error('Custom period requires both startDate and endDate');
      }
      dateRange = { startDate, endDate };
    } else {
      dateRange = this.calculateDateRange(period, year);
    }

    // Get statistics from repository
    return await this.repository.calculateStatistics(dateRange.startDate, dateRange.endDate, {
      personId,
      deptName,
      categoryId,
    });
  }
}
