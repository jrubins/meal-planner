import { z } from 'zod';

// Calendar dates ("2026-11-23") with no time or time zone. Dinners belong to a night, not to
// an instant, so dates travel as plain strings and the math here works in UTC, where every day
// is 24 hours long.

export const CalendarDateSchema = z.iso.date();
export type CalendarDate = z.infer<typeof CalendarDateSchema>;

/** 0 = Sunday, 1 = Monday. */
export const WeekStartsOnSchema = z.union([z.literal(0), z.literal(1)]);
export type WeekStartsOn = z.infer<typeof WeekStartsOnSchema>;

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(date: CalendarDate): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function fromUtc(ms: number): CalendarDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Day of the week: 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: CalendarDate): number {
  return new Date(toUtc(date)).getUTCDay();
}

/** The first night of the week containing `date`. */
export function startOfWeek(date: CalendarDate, weekStartsOn: WeekStartsOn): CalendarDate {
  return addDays(date, -((dayOfWeek(date) - weekStartsOn + 7) % 7));
}

/** The seven nights of the week containing `date`, in order. */
export function weekDates(date: CalendarDate, weekStartsOn: WeekStartsOn): CalendarDate[] {
  const start = startOfWeek(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** Today's date in an IANA time zone (e.g. "America/New_York"). */
export function todayIn(timeZone: string, now: Date = new Date()): CalendarDate {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** True when `timeZone` is a time zone this runtime knows. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}
