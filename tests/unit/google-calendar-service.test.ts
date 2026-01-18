import type { D1Database } from '@cloudflare/workers-types';
import { GoogleCalendarService } from '@worker/services/google-calendar-service';
import type { Env } from '@worker/types/env';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('GoogleCalendarService', () => {
  const createEnv = (): Env =>
    ({
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_REDIRECT_URI: 'https://example.test/oauth/callback',
    }) as Env;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('creates an instance with env and db', () => {
      const env = createEnv();
      const db = {} as D1Database;

      const service = new GoogleCalendarService(env, db);

      expect(service).toBeInstanceOf(GoogleCalendarService);
    });
  });

  describe('getEvents', () => {
    it('calls Google Calendar API with correct parameters', async () => {
      const env = createEnv();
      const db = {} as D1Database;
      const service = new GoogleCalendarService(env, db);

      vi.spyOn(
        service as unknown as { getAccessToken: (userEmail: string) => Promise<string> },
        'getAccessToken'
      ).mockResolvedValue('test-access-token');

      const mockResponse = {
        items: [
          {
            id: 'event-1',
            summary: 'Test Event',
            start: { dateTime: '2026-01-20T09:00:00+09:00' },
            end: { dateTime: '2026-01-20T10:00:00+09:00' },
            htmlLink: 'https://calendar.google.com/event/1',
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const startDate = '2026-01-19';
      const endDate = '2026-02-01';
      const events = await service.getEvents('user@example.com', startDate, endDate);

      expect(globalThis.fetch).toHaveBeenCalledOnce();
      const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
      const urlStr = typeof url === 'string' ? url : String(url);

      expect(urlStr).toContain('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      expect(urlStr).toContain('timeMin=');
      expect(urlStr).toContain('timeMax=');
      expect(urlStr).toContain('singleEvents=true');
      expect(urlStr).toContain('orderBy=startTime');

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        id: 'event-1',
        summary: 'Test Event',
        start: { dateTime: '2026-01-20T09:00:00+09:00' },
        end: { dateTime: '2026-01-20T10:00:00+09:00' },
        htmlLink: 'https://calendar.google.com/event/1',
      });
    });

    it('handles all-day events with date instead of dateTime', async () => {
      const env = createEnv();
      const db = {} as D1Database;
      const service = new GoogleCalendarService(env, db);

      vi.spyOn(
        service as unknown as { getAccessToken: (userEmail: string) => Promise<string> },
        'getAccessToken'
      ).mockResolvedValue('test-access-token');

      const mockResponse = {
        items: [
          {
            id: 'all-day-event',
            summary: 'All Day Event',
            start: { date: '2026-01-20' },
            end: { date: '2026-01-21' },
            htmlLink: 'https://calendar.google.com/event/2',
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const events = await service.getEvents('user@example.com', '2026-01-19', '2026-02-01');

      expect(events[0]).toEqual({
        id: 'all-day-event',
        summary: 'All Day Event',
        start: { date: '2026-01-20' },
        end: { date: '2026-01-21' },
        htmlLink: 'https://calendar.google.com/event/2',
      });
    });

    it('returns empty array when no events', async () => {
      const env = createEnv();
      const db = {} as D1Database;
      const service = new GoogleCalendarService(env, db);

      vi.spyOn(
        service as unknown as { getAccessToken: (userEmail: string) => Promise<string> },
        'getAccessToken'
      ).mockResolvedValue('test-access-token');

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), { status: 200 })
      );

      const events = await service.getEvents('user@example.com', '2026-01-19', '2026-02-01');

      expect(events).toEqual([]);
    });

    it('throws error when API call fails', async () => {
      const env = createEnv();
      const db = {} as D1Database;
      const service = new GoogleCalendarService(env, db);

      vi.spyOn(
        service as unknown as { getAccessToken: (userEmail: string) => Promise<string> },
        'getAccessToken'
      ).mockResolvedValue('test-access-token');

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Unauthorized', { status: 401 })
      );

      await expect(
        service.getEvents('user@example.com', '2026-01-19', '2026-02-01')
      ).rejects.toThrow('Failed to fetch calendar events');
    });

    it('filters out malformed events missing required fields', async () => {
      const env = createEnv();
      const db = {} as D1Database;
      const service = new GoogleCalendarService(env, db);

      vi.spyOn(
        service as unknown as { getAccessToken: (userEmail: string) => Promise<string> },
        'getAccessToken'
      ).mockResolvedValue('test-access-token');

      const mockResponse = {
        items: [
          // Valid event
          {
            id: 'valid-event',
            summary: 'Valid Event',
            start: { dateTime: '2026-01-20T09:00:00+09:00' },
            end: { dateTime: '2026-01-20T10:00:00+09:00' },
            htmlLink: 'https://calendar.google.com/event/1',
          },
          // Missing id
          {
            summary: 'No ID Event',
            start: { dateTime: '2026-01-20T11:00:00+09:00' },
            end: { dateTime: '2026-01-20T12:00:00+09:00' },
          },
          // Missing start
          {
            id: 'no-start',
            summary: 'No Start Event',
            end: { dateTime: '2026-01-20T13:00:00+09:00' },
          },
          // Missing end
          {
            id: 'no-end',
            summary: 'No End Event',
            start: { dateTime: '2026-01-20T14:00:00+09:00' },
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const events = await service.getEvents('user@example.com', '2026-01-19', '2026-02-01');

      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('valid-event');
    });
  });
});
