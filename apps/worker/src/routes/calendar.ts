/**
 * Calendar routes for Google Calendar integration
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, getAuthUser } from '../middleware/auth';
import { errorHandler } from '../middleware/error-handler';
import { bodyValidator, getValidatedBody } from '../middleware/validation-middleware';
import { GoogleCalendarService } from '../services/google-calendar-service';
import { GoogleOAuthService } from '../services/google-oauth-service';
import type { AppContext } from '../types/context';
import { DomainError } from '../types/errors';

const calendar = new Hono<AppContext>();
const calendarMeetingMinuteDraftSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  summary: z.string().optional(),
  description: z.string().optional(),
});

// All routes require authentication
calendar.use('*', authMiddleware);
calendar.use('*', errorHandler);

/**
 * GET /calendar/events - Get calendar events for a date range
 */
calendar.get('/events', async (c) => {
  const user = getAuthUser(c);
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  const timezoneOffsetParam = c.req.query('timezoneOffset');

  // Validate required parameters
  if (!startDate || !endDate) {
    throw new DomainError('startDate and endDate are required', 'VALIDATION_ERROR', 400);
  }

  // Parse timezone offset (in minutes, e.g., 540 for KST +09:00)
  const timezoneOffset = Number(timezoneOffsetParam ?? 0);
  if (Number.isNaN(timezoneOffset)) {
    throw new DomainError('Invalid timezoneOffset parameter', 'VALIDATION_ERROR', 400);
  }

  // Check if Google account is connected with calendar scope
  const oauthService = new GoogleOAuthService(c.env, c.env.DB);
  const tokens = await oauthService.getStoredTokens(user.email);

  if (!tokens) {
    throw new DomainError(
      'Google account is not connected. Please connect your Google account first.',
      'GOOGLE_NOT_CONNECTED',
      400
    );
  }

  // Check if token has calendar scope
  const hasCalendarScope = tokens.scope?.includes('calendar.readonly') ?? false;
  if (!hasCalendarScope) {
    throw new DomainError(
      'Google account needs calendar permission. Please reconnect your Google account.',
      'GOOGLE_NOT_CONNECTED',
      400
    );
  }

  // Fetch calendar events
  const calendarService = new GoogleCalendarService(c.env, c.env.DB);
  const events = await calendarService.getEvents(user.email, startDate, endDate, timezoneOffset);

  return c.json({ events });
});

/**
 * POST /calendar/meeting-minute-draft
 * Map calendar event fields to meeting-minute draft payload
 */
calendar.post('/meeting-minute-draft', bodyValidator(calendarMeetingMinuteDraftSchema), (c) => {
  const body = getValidatedBody<typeof calendarMeetingMinuteDraftSchema>(c);

  return c.json({
    meetingDate: body.date,
    topic: body.summary ?? '',
    detailsRaw: body.description ?? '',
  });
});

export { calendar };
