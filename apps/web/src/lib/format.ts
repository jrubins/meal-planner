import { daysBetween } from '@app/shared';

// Display formatting for calendar dates ("2026-11-24"). Dates are formatted in UTC so the
// browser's own time zone never shifts a night onto the day before.

const format = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(
    new Date(`${date}T00:00:00Z`),
  );

/** "Tuesday" */
export const weekdayName = (date: string) => format(date, { weekday: 'long' });

/** "Tue" */
export const weekdayShort = (date: string) => format(date, { weekday: 'short' });

/** "Nov 24" */
export const monthDay = (date: string) => format(date, { month: 'short', day: 'numeric' });

/** "Nov 23 – 29", or "Nov 30 – Dec 6" across months. */
export function weekRange(start: string, end: string): string {
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return `${monthDay(start)} – ${sameMonth ? format(end, { day: 'numeric' }) : monthDay(end)}`;
}

/** "today", "yesterday", "3 days ago", "5 weeks ago", or "never" for null. */
export function lastEaten(date: string | null, today: string): string {
  if (!date) return 'never';
  const days = daysBetween(date, today);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

/** A member's name for display: their display name, or "You" / "Partner". */
export function memberName(
  member: { userId: string; displayName: string | null },
  me: string,
): string {
  return member.displayName ?? (member.userId === me ? 'You' : 'Partner');
}
