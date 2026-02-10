// Trace: SPEC-ai-gateway-logs-1, TASK-ai-gateway-logs-1
/**
 * Zod validation schemas for AI Gateway logs endpoint
 */

import { z } from 'zod';

const isoDateTimeSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Invalid ISO datetime value',
});

export const aiGatewayLogsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
    order: z.enum(['asc', 'desc']).default('desc'),
    orderBy: z.enum(['created_at', 'started_at']).default('created_at'),
    search: z.string().trim().min(1).max(500).optional(),
    startDate: isoDateTimeSchema.optional(),
    endDate: isoDateTimeSchema.optional(),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) {
        return true;
      }
      return new Date(data.startDate).getTime() <= new Date(data.endDate).getTime();
    },
    {
      message: 'startDate must be less than or equal to endDate',
      path: ['startDate'],
    }
  );

export type AIGatewayLogsQuery = z.infer<typeof aiGatewayLogsQuerySchema>;
