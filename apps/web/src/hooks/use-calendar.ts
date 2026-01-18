import { useQuery } from '@tanstack/react-query';
import { API } from '@web/lib/api';
import type { CalendarEvent } from '@web/types/api';

export interface UseCalendarEventsOptions {
  enabled?: boolean;
}

export function useCalendarEvents(
  startDate: string,
  endDate: string,
  options: UseCalendarEventsOptions = {}
) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ['calendar-events', startDate, endDate],
    queryFn: async () => {
      const response = await API.getCalendarEvents(startDate, endDate);
      return response.events;
    },
    enabled: enabled && !!startDate && !!endDate,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Check if an event is an all-day event
 */
export function isAllDayEvent(event: CalendarEvent): boolean {
  return !!event.start.date && !event.start.dateTime;
}

/**
 * Get the start date of an event
 */
export function getEventStartDate(event: CalendarEvent): Date {
  if (event.start.dateTime) {
    return new Date(event.start.dateTime);
  }
  // All-day events use date string (YYYY-MM-DD)
  return new Date(`${event.start.date}T00:00:00`);
}

/**
 * Get the end date of an event
 */
export function getEventEndDate(event: CalendarEvent): Date {
  if (event.end.dateTime) {
    return new Date(event.end.dateTime);
  }
  // All-day events use date string (YYYY-MM-DD)
  return new Date(`${event.end.date}T00:00:00`);
}
