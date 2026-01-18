/**
 * Google Calendar service for fetching calendar events
 */

import type { Env } from '../types/env';
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
   */
  async getEvents(userEmail: string, startDate: string, endDate: string): Promise<CalendarEvent[]> {
    const accessToken = await this.getAccessToken(userEmail);

    const timeMin = new Date(startDate).toISOString();
    const timeMax = new Date(endDate).toISOString();

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
