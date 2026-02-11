import { z } from 'zod';

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createMeetingMinuteSchema = z.object({
  meetingDate: z.string().regex(dateOnlyRegex, 'meetingDate must be YYYY-MM-DD'),
  topic: z.string().min(1, 'topic is required').max(200),
  detailsRaw: z.string().min(1, 'detailsRaw is required'),
  attendeePersonIds: z.array(z.string().length(6)).min(1, 'at least one attendee is required'),
  categoryIds: z.array(z.string()).optional(),
});

export const updateMeetingMinuteSchema = createMeetingMinuteSchema.partial();

export type CreateMeetingMinuteInput = z.infer<typeof createMeetingMinuteSchema>;
export type UpdateMeetingMinuteInput = z.infer<typeof updateMeetingMinuteSchema>;
