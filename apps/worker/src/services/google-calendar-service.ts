/**
 * Google Calendar service for fetching calendar events
 */

import type { Env } from '../types/env';
import { DomainError } from '../types/errors';
import { GoogleOAuthService } from './google-oauth-service';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink: string;
}

interface CalendarEventsResponse {
  items: Array<{
    id: string;
    summary?: string;
    description?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    htmlLink?: string;
  }>;
}

export class GoogleCalendarService {
  private oauthService: GoogleOAuthService;

  constructor(env: Env, db: D1Database) {
    this.oauthService = new GoogleOAuthService(env, db);
  }

  protected async getAccessToken(userEmail: string): Promise<string> {
    return this.oauthService.getValidAccessToken(userEmail);
  }

  /**
   * Fetch calendar events within a date range
   * @param timezoneOffset - Timezone offset in minutes (e.g., 540 for KST +09:00)
   */
  async getEvents(
    userEmail: string,
    startDate: string,
    endDate: string,
    timezoneOffset = 0
  ): Promise<CalendarEvent[]> {
    const accessToken = await this.getAccessToken(userEmail);

    // Convert local date strings to UTC timestamps with timezone offset
    // startDate at local midnight -> UTC
    // endDate at local 23:59:59 -> UTC
    const offsetMs = timezoneOffset * 60 * 1000;

    // Parse dates as UTC and adjust for timezone
    const startUtc = new Date(`${startDate}T00:00:00.000Z`);
    startUtc.setTime(startUtc.getTime() - offsetMs);

    const endUtc = new Date(`${endDate}T23:59:59.000Z`);
    endUtc.setTime(endUtc.getTime() - offsetMs);

    const timeMin = startUtc.toISOString();
    const timeMax = endUtc.toISOString();

    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    const url = `${GOOGLE_CALENDAR_API}/calendars/primary/events?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      // Handle 403 as permission denied - user needs to reconnect
      if (response.status === 403) {
        throw new DomainError(
          'Calendar access denied. Please reconnect your Google account.',
          'GOOGLE_NOT_CONNECTED',
          400
        );
      }
      throw new Error(`Failed to fetch calendar events: ${await response.text()}`);
    }

    const data = (await response.json()) as CalendarEventsResponse;

    return (data.items ?? []).map((item) => ({
      id: item.id,
      summary: item.summary ?? '',
      description: item.description,
      start: item.start ?? {},
      end: item.end ?? {},
      htmlLink: item.htmlLink ?? '',
    }));
  }
}
