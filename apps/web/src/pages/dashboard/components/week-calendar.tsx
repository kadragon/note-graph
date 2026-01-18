import { cn } from '@web/lib/utils';
import type { CalendarEvent } from '@web/types/api';
import { addDays, eachDayOfInterval, format, isToday, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ExternalLink } from 'lucide-react';

interface WeekCalendarProps {
  events: CalendarEvent[];
  startDate: Date;
  weeks?: number;
}

interface DayEvents {
  date: Date;
  events: CalendarEvent[];
}

function getEventDate(event: CalendarEvent): Date {
  if (event.start.dateTime) {
    return new Date(event.start.dateTime);
  }
  // All-day events use date string (YYYY-MM-DD)
  return new Date(`${event.start.date}T00:00:00`);
}

function isAllDayEvent(event: CalendarEvent): boolean {
  return !!event.start.date && !event.start.dateTime;
}

function formatEventTime(event: CalendarEvent): string {
  if (isAllDayEvent(event)) {
    return '종일';
  }
  if (event.start.dateTime) {
    return format(new Date(event.start.dateTime), 'HH:mm');
  }
  return '';
}

export function WeekCalendar({ events, startDate, weeks = 2 }: WeekCalendarProps) {
  // Start from the beginning of the current week
  const weekStart = startOfWeek(startDate, { weekStartsOn: 1 }); // Monday start
  const endDate = addDays(weekStart, weeks * 7 - 1);

  // Generate all days in the range
  const days = eachDayOfInterval({ start: weekStart, end: endDate });

  // Group events by date
  const dayEventsMap = new Map<string, CalendarEvent[]>();
  events.forEach((event) => {
    const eventDate = getEventDate(event);
    const dateKey = format(eventDate, 'yyyy-MM-dd');
    const existing = dayEventsMap.get(dateKey) || [];
    dayEventsMap.set(dateKey, [...existing, event]);
  });

  // Create day events array
  const dayEvents: DayEvents[] = days.map((date) => ({
    date,
    events: dayEventsMap.get(format(date, 'yyyy-MM-dd')) || [],
  }));

  // Split into weeks
  const weekGroups: DayEvents[][] = [];
  for (let i = 0; i < dayEvents.length; i += 7) {
    weekGroups.push(dayEvents.slice(i, i + 7));
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      {/* Header - Day names */}
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {['월', '화', '수', '목', '금', '토', '일'].map((day, index) => (
          <div
            key={day}
            className={cn(
              'py-2 text-center text-sm font-medium',
              index === 5 && 'text-blue-600',
              index === 6 && 'text-red-600'
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {weekGroups.map((week) => (
        <div key={week[0].date.toISOString()} className="grid grid-cols-7 border-b last:border-b-0">
          {week.map((day, dayIndex) => (
            <DayCell
              key={day.date.toISOString()}
              day={day}
              isWeekend={dayIndex >= 5}
              isSaturday={dayIndex === 5}
              isSunday={dayIndex === 6}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface DayCellProps {
  day: DayEvents;
  isWeekend: boolean;
  isSaturday: boolean;
  isSunday: boolean;
}

function DayCell({ day, isSaturday, isSunday }: DayCellProps) {
  const today = isToday(day.date);
  const maxVisibleEvents = 2;
  const visibleEvents = day.events.slice(0, maxVisibleEvents);
  const remainingCount = day.events.length - maxVisibleEvents;

  return (
    <div className={cn('min-h-[80px] border-r p-1 last:border-r-0', today && 'bg-primary/5')}>
      {/* Date header */}
      <div className="mb-1 flex items-center justify-between">
        <span
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
            today && 'bg-primary text-primary-foreground font-bold',
            !today && isSaturday && 'text-blue-600',
            !today && isSunday && 'text-red-600'
          )}
        >
          {format(day.date, 'd')}
        </span>
        {day.date.getDate() === 1 && (
          <span className="text-xs text-muted-foreground">
            {format(day.date, 'M월', { locale: ko })}
          </span>
        )}
      </div>

      {/* Events */}
      <div className="space-y-0.5">
        {visibleEvents.map((event) => (
          <EventItem key={event.id} event={event} />
        ))}
        {remainingCount > 0 && (
          <div className="text-xs text-muted-foreground">+{remainingCount}개 더</div>
        )}
      </div>
    </div>
  );
}

interface EventItemProps {
  event: CalendarEvent;
}

function EventItem({ event }: EventItemProps) {
  const allDay = isAllDayEvent(event);
  const time = formatEventTime(event);

  return (
    <a
      href={event.htmlLink}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group flex items-start gap-1 rounded px-1 py-0.5 text-xs transition-colors',
        allDay ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'hover:bg-muted'
      )}
      title={`${time} ${event.summary}`}
    >
      <span className="flex-1 truncate">
        {!allDay && <span className="text-muted-foreground">{time} </span>}
        {event.summary}
      </span>
      <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
    </a>
  );
}
