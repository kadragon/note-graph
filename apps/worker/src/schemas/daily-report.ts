import { z } from 'zod';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const generateDailyReportSchema = z.object({
  date: z.string().regex(DATE_REGEX, 'Must be YYYY-MM-DD format'),
  timezoneOffset: z.number().int().optional(),
});

export const getDailyReportsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(7),
});

export const dailyReportAIAnalysisSchema = z.object({
  scheduleSummary: z.string().default(''),
  todoPriorities: z
    .array(
      z.object({
        todoTitle: z.string(),
        reason: z.string(),
        suggestedOrder: z.number(),
      })
    )
    .default([]),
  timeAllocation: z
    .array(
      z.object({
        timeBlock: z.string(),
        activity: z.string(),
        reason: z.string(),
      })
    )
    .default([]),
  conflicts: z
    .array(
      z.object({
        description: z.string(),
        suggestion: z.string(),
      })
    )
    .default([]),
  progressVsPrevious: z.string().default(''),
  actionItems: z.array(z.string()).default([]),
});

export type GenerateDailyReportInput = z.infer<typeof generateDailyReportSchema>;
export type GetDailyReportsQuery = z.infer<typeof getDailyReportsQuerySchema>;
