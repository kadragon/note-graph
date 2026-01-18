/**
 * Calendar routes for Google Calendar integration
 */

import { Hono } from 'hono';
import { authMiddleware, getAuthUser } from '../middleware/auth';
import { errorHandler } from '../middleware/error-handler';
import { GoogleCalendarService } from '../services/google-calendar-service';
import { GoogleOAuthService } from '../services/google-oauth-service';
import type { AppContext } from '../types/context';
import { DomainError } from '../types/errors';

const calendar = new Hono<AppContext>();

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

  // Validate required parameters
  if (!startDate || !endDate) {
    throw new DomainError('startDate and endDate are required', 'VALIDATION_ERROR', 400);
  }

  // Check if Google account is connected
  const oauthService = new GoogleOAuthService(c.env, c.env.DB);
  const tokens = await oauthService.getStoredTokens(user.email);

  if (!tokens) {
    throw new DomainError(
      'Google account is not connected. Please connect your Google account first.',
      'GOOGLE_NOT_CONNECTED',
      400
    );
  }

  // Fetch calendar events
  const calendarService = new GoogleCalendarService(c.env, c.env.DB);
  const events = await calendarService.getEvents(user.email, startDate, endDate);

  return c.json({ events });
});

export { calendar };
