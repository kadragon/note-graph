import { z } from 'zod';
import { positiveIntegerQuery } from './schema-helpers';

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createMeetingMinuteSchema = z.object({
  meetingDate: z.string().regex(dateOnlyRegex, 'meetingDate must be YYYY-MM-DD'),
  topic: z.string().min(1, 'topic is required').max(200),
  detailsRaw: z.string().min(1, 'detailsRaw is required'),
  attendeePersonIds: z.array(z.string().length(6)).min(1, 'at least one attendee is required'),
  categoryIds: z.array(z.string()).optional(),
});

export const updateMeetingMinuteSchema = createMeetingMinuteSchema.partial();

export const listMeetingMinutesQuerySchema = z.object({
  q: z.string().optional(),
  meetingDateFrom: z.string().optional(),
  meetingDateTo: z.string().optional(),
  categoryId: z.string().optional(),
  attendeePersonId: z.string().optional(),
  page: positiveIntegerQuery(1),
  pageSize: positiveIntegerQuery(20),
});

export type CreateMeetingMinuteInput = z.infer<typeof createMeetingMinuteSchema>;
export type UpdateMeetingMinuteInput = z.infer<typeof updateMeetingMinuteSchema>;
export type ListMeetingMinutesQuery = z.infer<typeof listMeetingMinutesQuerySchema>;
