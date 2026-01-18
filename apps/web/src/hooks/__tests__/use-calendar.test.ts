import { waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import { renderHookWithClient } from '@web/test/setup';
import type { CalendarEvent } from '@web/types/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getEventEndDate,
  getEventStartDate,
  isAllDayEvent,
  useCalendarEvents,
} from '../use-calendar';

vi.mock('@web/lib/api', () => ({
  API: {
    getCalendarEvents: vi.fn(),
  },
}));

describe('useCalendarEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches calendar events with date range', async () => {
    const events: CalendarEvent[] = [
      {
        id: 'event-1',
        summary: 'Test Event',
        start: { dateTime: '2026-01-20T10:00:00+09:00' },
        end: { dateTime: '2026-01-20T11:00:00+09:00' },
        htmlLink: 'https://calendar.google.com/event/1',
      },
    ];
    vi.mocked(API.getCalendarEvents).mockResolvedValue({ events });

    const { result } = renderHookWithClient(() => useCalendarEvents('2026-01-19', '2026-02-01'));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getCalendarEvents).toHaveBeenCalledWith('2026-01-19', '2026-02-01');
    expect(result.current.data).toEqual(events);
  });

  it('does not fetch when disabled', async () => {
    renderHookWithClient(() => useCalendarEvents('2026-01-19', '2026-02-01', { enabled: false }));

    await waitFor(() => {
      expect(API.getCalendarEvents).not.toHaveBeenCalled();
    });
  });

  it('does not fetch when startDate is empty', async () => {
    renderHookWithClient(() => useCalendarEvents('', '2026-02-01'));

    await waitFor(() => {
      expect(API.getCalendarEvents).not.toHaveBeenCalled();
    });
  });

  it('does not fetch when endDate is empty', async () => {
    renderHookWithClient(() => useCalendarEvents('2026-01-19', ''));

    await waitFor(() => {
      expect(API.getCalendarEvents).not.toHaveBeenCalled();
    });
  });

  it('handles API error', async () => {
    vi.mocked(API.getCalendarEvents).mockRejectedValue(new Error('API Error'));

    const { result } = renderHookWithClient(() => useCalendarEvents('2026-01-19', '2026-02-01'));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('API Error');
  });
});

describe('isAllDayEvent', () => {
  it('returns true for all-day events', () => {
    const event: CalendarEvent = {
      id: 'event-1',
      summary: 'All Day Event',
      start: { date: '2026-01-20' },
      end: { date: '2026-01-21' },
      htmlLink: 'https://calendar.google.com/event/1',
    };

    expect(isAllDayEvent(event)).toBe(true);
  });

  it('returns false for timed events', () => {
    const event: CalendarEvent = {
      id: 'event-1',
      summary: 'Timed Event',
      start: { dateTime: '2026-01-20T10:00:00+09:00' },
      end: { dateTime: '2026-01-20T11:00:00+09:00' },
      htmlLink: 'https://calendar.google.com/event/1',
    };

    expect(isAllDayEvent(event)).toBe(false);
  });
});

describe('getEventStartDate', () => {
  it('returns correct date for timed events', () => {
    const event: CalendarEvent = {
      id: 'event-1',
      summary: 'Timed Event',
      start: { dateTime: '2026-01-20T10:00:00+09:00' },
      end: { dateTime: '2026-01-20T11:00:00+09:00' },
      htmlLink: 'https://calendar.google.com/event/1',
    };

    const result = getEventStartDate(event);
    expect(result.toISOString()).toContain('2026-01-20');
  });

  it('returns midnight for all-day events', () => {
    const event: CalendarEvent = {
      id: 'event-1',
      summary: 'All Day Event',
      start: { date: '2026-01-20' },
      end: { date: '2026-01-21' },
      htmlLink: 'https://calendar.google.com/event/1',
    };

    const result = getEventStartDate(event);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });
});

describe('getEventEndDate', () => {
  it('returns correct date for timed events', () => {
    const event: CalendarEvent = {
      id: 'event-1',
      summary: 'Timed Event',
      start: { dateTime: '2026-01-20T10:00:00+09:00' },
      end: { dateTime: '2026-01-20T11:00:00+09:00' },
      htmlLink: 'https://calendar.google.com/event/1',
    };

    const result = getEventEndDate(event);
    expect(result.toISOString()).toContain('2026-01-20');
  });

  it('returns midnight for all-day events', () => {
    const event: CalendarEvent = {
      id: 'event-1',
      summary: 'All Day Event',
      start: { date: '2026-01-20' },
      end: { date: '2026-01-21' },
      htmlLink: 'https://calendar.google.com/event/1',
    };

    const result = getEventEndDate(event);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });
});
