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
  private calendarIds: string[];

  constructor(env: Env, db: D1Database) {
    this.oauthService = new GoogleOAuthService(env, db);
    // Parse calendar IDs from environment variable, defaulting to 'primary'
    const parsed = env.GOOGLE_CALENDAR_IDS?.split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    this.calendarIds = parsed?.length ? parsed : ['primary'];
  }

  protected async getAccessToken(userEmail: string): Promise<string> {
    return this.oauthService.getValidAccessToken(userEmail);
  }

  /**
   * Fetch calendar events within a date range from all configured calendars
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

    // Fetch events from all calendars in parallel, tolerating individual calendar failures
    const results = await Promise.allSettled(
      this.calendarIds.map((calendarId) =>
        this.fetchCalendarEvents(accessToken, calendarId, timeMin, timeMax)
      )
    );

    // Collect events from successful calendars only
    const allEvents: CalendarEvent[] = [];
    let successCount = 0;
    let lastError: Error | undefined;

    for (const result of results) {
      if (result.status === 'fulfilled') {
        successCount++;
        allEvents.push(...result.value);
      } else if (result.status === 'rejected') {
        // Track all failures including DomainErrors for graceful degradation
        lastError =
          result.reason instanceof Error ? result.reason : new Error(String(result.reason));
      }
    }

    // If all calendars failed, throw an error
    if (successCount === 0 && results.length > 0) {
      // Re-throw DomainError (e.g., 403) to allow proper error handling for user action
      if (lastError instanceof DomainError) {
        throw lastError;
      }
      throw new Error(
        `Failed to fetch events from all calendars${lastError ? `: ${lastError.message}` : ''}`
      );
    }

    // Sort by start time using timestamps for correct timezone handling
    return allEvents.sort((a, b) => {
      const aStart = a.start.dateTime ?? a.start.date;
      const bStart = b.start.dateTime ?? b.start.date;

      // Handle missing start dates - move to end
      if (!aStart && !bStart) return 0;
      if (!aStart) return 1;
      if (!bStart) return -1;

      const aTime = new Date(aStart).getTime();
      const bTime = new Date(bStart).getTime();

      // Handle invalid dates (NaN) - move to end
      if (isNaN(aTime) && isNaN(bTime)) return 0;
      if (isNaN(aTime)) return 1;
      if (isNaN(bTime)) return -1;

      return aTime - bTime;
    });
  }

  private async fetchCalendarEvents(
    accessToken: string,
    calendarId: string,
    timeMin: string,
    timeMax: string
  ): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    const encodedCalendarId = encodeURIComponent(calendarId);
    const url = `${GOOGLE_CALENDAR_API}/calendars/${encodedCalendarId}/events?${params.toString()}`;

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

    return (data.items ?? [])
      .filter((item) => item.id && item.start && item.end)
      .map((item) => ({
        id: item.id,
        summary: item.summary ?? '',
        description: item.description,
        start: item.start!,
        end: item.end!,
        htmlLink: item.htmlLink ?? '',
      }));
  }
}
