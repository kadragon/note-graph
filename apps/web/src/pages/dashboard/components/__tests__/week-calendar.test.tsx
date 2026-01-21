import { render, screen } from '@web/test/setup';
import type { CalendarEvent } from '@web/types/api';
import { describe, expect, it } from 'vitest';

import { WeekCalendar } from '../week-calendar';

describe('WeekCalendar', () => {
  it('renders all-day events across multiple days', () => {
    const event: CalendarEvent = {
      id: 'event-1',
      summary: '출장',
      start: { date: '2026-01-19' },
      end: { date: '2026-01-21' },
      htmlLink: 'https://calendar.example.com/event-1',
    };

    render(<WeekCalendar events={[event]} startDate={new Date('2026-01-19T00:00:00')} weeks={1} />);

    expect(screen.getAllByText('출장')).toHaveLength(2);
  });

  it('starts the week on Sunday', () => {
    render(<WeekCalendar events={[]} startDate={new Date('2026-01-19T00:00:00')} weeks={1} />);

    const headersContainer = screen.getByTestId('weekday-headers');
    const labels = Array.from(headersContainer.children).map((node) => node.textContent);

    expect(labels).toEqual(['일', '월', '화', '수', '목', '금', '토']);
  });

  it('renders single-day all-day events on one day only', () => {
    const event: CalendarEvent = {
      id: 'event-1',
      summary: '회의',
      start: { date: '2026-01-19' },
      end: { date: '2026-01-20' }, // exclusive end date, so only 19th
      htmlLink: 'https://calendar.example.com/event-1',
    };

    render(<WeekCalendar events={[event]} startDate={new Date('2026-01-19T00:00:00')} weeks={1} />);

    expect(screen.getAllByText('회의')).toHaveLength(1);
  });
});
