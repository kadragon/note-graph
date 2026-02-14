import { format, isValid, parseISO } from 'date-fns';

function parseDate(value: string): Date | null {
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

export function formatDateTimeOrFallback(
  value: string,
  formatString: string,
  fallback: string
): string {
  const date = parseDate(value);
  return date ? format(date, formatString) : fallback;
}

const kstDateTimeFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatDateTimeInKstOrFallback(value: string, fallback: string = '-'): string {
  const date = parseDate(value);
  return date ? kstDateTimeFormatter.format(date) : fallback;
}
