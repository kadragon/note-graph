// Trace: SPEC-stats-1, TASK-047
/**
 * Zod validation schemas for statistics API
 */

import { z } from 'zod';

/**
 * Period enum for statistics filtering
 */
export const statisticsPeriodSchema = z.enum([
  'this-week',
  'this-month',
  'first-half',
  'second-half',
  'this-year',
  'last-week',
  'custom',
]);

/**
 * Query parameters for statistics endpoint
 */
export const statisticsQuerySchema = z
  .object({
    period: statisticsPeriodSchema.default('this-week'),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    personId: z.string().optional(),
    deptName: z.string().optional(),
    category: z.string().optional(),
  })
  .refine(
    (data) => {
      // If period is 'custom', both startDate and endDate must be provided
      if (data.period === 'custom') {
        return data.startDate && data.endDate;
      }
      return true;
    },
    {
      message: 'startDate and endDate are required when period is "custom"',
    }
  );

export type StatisticsQuery = z.infer<typeof statisticsQuerySchema>;
export type StatisticsPeriod = z.infer<typeof statisticsPeriodSchema>;
