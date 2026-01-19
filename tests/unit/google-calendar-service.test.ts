import type { D1Database } from '@cloudflare/workers-types';
import { GoogleCalendarService } from '@worker/services/google-calendar-service';
import type { Env } from '@worker/types/env';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('GoogleCalendarService', () => {
  const createEnv = (overrides?: Partial<Env>): Env =>
    ({
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_REDIRECT_URI: 'https://example.test/oauth/callback',
      ...overrides,
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

    it('throws DomainError when calendar returns 403 permission denied', async () => {
      const env = createEnv();
      const db = {} as D1Database;
      const service = new GoogleCalendarService(env, db);

      vi.spyOn(
        service as unknown as { getAccessToken: (userEmail: string) => Promise<string> },
        'getAccessToken'
      ).mockResolvedValue('test-access-token');

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Forbidden', { status: 403 }));

      await expect(
        service.getEvents('user@example.com', '2026-01-19', '2026-02-01')
      ).rejects.toThrow('Calendar access denied');
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

    it('uses primary calendar when GOOGLE_CALENDAR_IDS is not set', async () => {
      const env = createEnv(); // No GOOGLE_CALENDAR_IDS
      const db = {} as D1Database;
      const service = new GoogleCalendarService(env, db);

      vi.spyOn(
        service as unknown as { getAccessToken: (userEmail: string) => Promise<string> },
        'getAccessToken'
      ).mockResolvedValue('test-access-token');

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), { status: 200 })
      );

      await service.getEvents('user@example.com', '2026-01-19', '2026-02-01');

      expect(globalThis.fetch).toHaveBeenCalledOnce();
      const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(String(url)).toContain('/calendars/primary/events');
    });

    it('fetches events from multiple calendars when GOOGLE_CALENDAR_IDS is set', async () => {
      const env = createEnv({
        GOOGLE_CALENDAR_IDS: 'primary,work@group.calendar.google.com',
      });
      const db = {} as D1Database;
      const service = new GoogleCalendarService(env, db);

      vi.spyOn(
        service as unknown as { getAccessToken: (userEmail: string) => Promise<string> },
        'getAccessToken'
      ).mockResolvedValue('test-access-token');

      const mockFetch = vi.spyOn(globalThis, 'fetch');
      mockFetch.mockImplementation((url) => {
        const urlStr = String(url);
        if (urlStr.includes('/calendars/primary/')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                items: [
                  {
                    id: 'primary-event',
                    summary: 'Primary Event',
                    start: { dateTime: '2026-01-20T09:00:00+09:00' },
                    end: { dateTime: '2026-01-20T10:00:00+09:00' },
                    htmlLink: 'https://calendar.google.com/event/1',
                  },
                ],
              }),
              { status: 200 }
            )
          );
        } else if (urlStr.includes('work%40group.calendar.google.com')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                items: [
                  {
                    id: 'work-event',
                    summary: 'Work Event',
                    start: { dateTime: '2026-01-20T14:00:00+09:00' },
                    end: { dateTime: '2026-01-20T15:00:00+09:00' },
                    htmlLink: 'https://calendar.google.com/event/2',
                  },
                ],
              }),
              { status: 200 }
            )
          );
        }
        return Promise.resolve(new Response('Not found', { status: 404 }));
      });

      const events = await service.getEvents('user@example.com', '2026-01-19', '2026-02-01');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(events).toHaveLength(2);
      expect(events.map((e) => e.id)).toContain('primary-event');
      expect(events.map((e) => e.id)).toContain('work-event');
    });

    it('sorts events from multiple calendars by start time', async () => {
      const env = createEnv({
        GOOGLE_CALENDAR_IDS: 'cal-a,cal-b',
      });
      const db = {} as D1Database;
      const service = new GoogleCalendarService(env, db);

      vi.spyOn(
        service as unknown as { getAccessToken: (userEmail: string) => Promise<string> },
        'getAccessToken'
      ).mockResolvedValue('test-access-token');

      const mockFetch = vi.spyOn(globalThis, 'fetch');
      mockFetch.mockImplementation((url) => {
        const urlStr = String(url);
        if (urlStr.includes('cal-a')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                items: [
                  {
                    id: 'event-later',
                    summary: 'Later Event',
                    start: { dateTime: '2026-01-20T14:00:00+09:00' },
                    end: { dateTime: '2026-01-20T15:00:00+09:00' },
                    htmlLink: 'https://calendar.google.com/event/2',
                  },
                ],
              }),
              { status: 200 }
            )
          );
        } else if (urlStr.includes('cal-b')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                items: [
                  {
                    id: 'event-earlier',
                    summary: 'Earlier Event',
                    start: { dateTime: '2026-01-20T09:00:00+09:00' },
                    end: { dateTime: '2026-01-20T10:00:00+09:00' },
                    htmlLink: 'https://calendar.google.com/event/1',
                  },
                ],
              }),
              { status: 200 }
            )
          );
        }
        return Promise.resolve(new Response('Not found', { status: 404 }));
      });

      const events = await service.getEvents('user@example.com', '2026-01-19', '2026-02-01');

      expect(events).toHaveLength(2);
      // First event should be the earlier one (09:00), second should be later (14:00)
      expect(events[0].id).toBe('event-earlier');
      expect(events[1].id).toBe('event-later');
    });

    it('returns events from successful calendars when some calendars fail with 403', async () => {
      const env = createEnv({
        GOOGLE_CALENDAR_IDS: 'good-cal,forbidden-cal',
      });
      const db = {} as D1Database;
      const service = new GoogleCalendarService(env, db);

      vi.spyOn(
        service as unknown as { getAccessToken: (userEmail: string) => Promise<string> },
        'getAccessToken'
      ).mockResolvedValue('test-access-token');

      const mockFetch = vi.spyOn(globalThis, 'fetch');
      mockFetch.mockImplementation((url) => {
        const urlStr = String(url);
        if (urlStr.includes('good-cal')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                items: [
                  {
                    id: 'good-event',
                    summary: 'Good Event',
                    start: { dateTime: '2026-01-20T09:00:00+09:00' },
                    end: { dateTime: '2026-01-20T10:00:00+09:00' },
                    htmlLink: 'https://calendar.google.com/event/1',
                  },
                ],
              }),
              { status: 200 }
            )
          );
        } else if (urlStr.includes('forbidden-cal')) {
          // 403 should be handled gracefully when other calendars succeed
          return Promise.resolve(new Response('Forbidden', { status: 403 }));
        }
        return Promise.resolve(new Response('Not found', { status: 404 }));
      });

      const events = await service.getEvents('user@example.com', '2026-01-19', '2026-02-01');

      // Should still return events from the successful calendar (graceful degradation)
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('good-event');
    });

    it('returns events from successful calendars when some calendars fail with 404', async () => {
      const env = createEnv({
        GOOGLE_CALENDAR_IDS: 'good-cal,missing-cal',
      });
      const db = {} as D1Database;
      const service = new GoogleCalendarService(env, db);

      vi.spyOn(
        service as unknown as { getAccessToken: (userEmail: string) => Promise<string> },
        'getAccessToken'
      ).mockResolvedValue('test-access-token');

      const mockFetch = vi.spyOn(globalThis, 'fetch');
      mockFetch.mockImplementation((url) => {
        const urlStr = String(url);
        if (urlStr.includes('good-cal')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                items: [
                  {
                    id: 'good-event',
                    summary: 'Good Event',
                    start: { dateTime: '2026-01-20T09:00:00+09:00' },
                    end: { dateTime: '2026-01-20T10:00:00+09:00' },
                    htmlLink: 'https://calendar.google.com/event/1',
                  },
                ],
              }),
              { status: 200 }
            )
          );
        } else if (urlStr.includes('missing-cal')) {
          return Promise.resolve(new Response('Not found', { status: 404 }));
        }
        return Promise.resolve(new Response('Not found', { status: 404 }));
      });

      const events = await service.getEvents('user@example.com', '2026-01-19', '2026-02-01');

      // Should still return events from the successful calendar
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('good-event');
    });

    it('falls back to primary when GOOGLE_CALENDAR_IDS is empty or whitespace', async () => {
      const env = createEnv({
        GOOGLE_CALENDAR_IDS: '  , , ', // Empty/whitespace only
      });
      const db = {} as D1Database;
      const service = new GoogleCalendarService(env, db);

      vi.spyOn(
        service as unknown as { getAccessToken: (userEmail: string) => Promise<string> },
        'getAccessToken'
      ).mockResolvedValue('test-access-token');

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), { status: 200 })
      );

      await service.getEvents('user@example.com', '2026-01-19', '2026-02-01');

      expect(globalThis.fetch).toHaveBeenCalledOnce();
      const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(String(url)).toContain('/calendars/primary/events');
    });

    it('throws error when all calendars fail', async () => {
      const env = createEnv({
        GOOGLE_CALENDAR_IDS: 'cal-a,cal-b',
      });
      const db = {} as D1Database;
      const service = new GoogleCalendarService(env, db);

      vi.spyOn(
        service as unknown as { getAccessToken: (userEmail: string) => Promise<string> },
        'getAccessToken'
      ).mockResolvedValue('test-access-token');

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Server Error', { status: 500 })
      );

      await expect(
        service.getEvents('user@example.com', '2026-01-19', '2026-02-01')
      ).rejects.toThrow('Failed to fetch events from all calendars');
    });

    it('sorts events correctly across different timezones', async () => {
      const env = createEnv({
        GOOGLE_CALENDAR_IDS: 'korea,us-east',
      });
      const db = {} as D1Database;
      const service = new GoogleCalendarService(env, db);

      vi.spyOn(
        service as unknown as { getAccessToken: (userEmail: string) => Promise<string> },
        'getAccessToken'
      ).mockResolvedValue('test-access-token');

      const mockFetch = vi.spyOn(globalThis, 'fetch');
      mockFetch.mockImplementation((url) => {
        const urlStr = String(url);
        if (urlStr.includes('korea')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                items: [
                  {
                    id: 'korea-event',
                    summary: 'Korea Event',
                    // 2026-01-20 09:00 KST = 2026-01-20 00:00 UTC
                    start: { dateTime: '2026-01-20T09:00:00+09:00' },
                    end: { dateTime: '2026-01-20T10:00:00+09:00' },
                    htmlLink: 'https://calendar.google.com/event/1',
                  },
                ],
              }),
              { status: 200 }
            )
          );
        } else if (urlStr.includes('us-east')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                items: [
                  {
                    id: 'us-event',
                    summary: 'US Event',
                    // 2026-01-20 00:30 EST = 2026-01-20 05:30 UTC (later than Korea event)
                    start: { dateTime: '2026-01-20T00:30:00-05:00' },
                    end: { dateTime: '2026-01-20T01:30:00-05:00' },
                    htmlLink: 'https://calendar.google.com/event/2',
                  },
                ],
              }),
              { status: 200 }
            )
          );
        }
        return Promise.resolve(new Response('Not found', { status: 404 }));
      });

      const events = await service.getEvents('user@example.com', '2026-01-19', '2026-02-01');

      expect(events).toHaveLength(2);
      // Korea event (UTC 00:00) should come before US event (UTC 05:30)
      expect(events[0].id).toBe('korea-event');
      expect(events[1].id).toBe('us-event');
    });
  });
});
