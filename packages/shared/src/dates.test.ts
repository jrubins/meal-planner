import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, startOfWeek, todayIn, weekDates } from './dates.ts';

describe('calendar dates', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('finds the start of a Monday week', () => {
    // 2026-11-23 is a Monday.
    expect(startOfWeek('2026-11-23', 1)).toBe('2026-11-23');
    expect(startOfWeek('2026-11-29', 1)).toBe('2026-11-23');
    expect(startOfWeek('2026-11-30', 1)).toBe('2026-11-30');
  });

  it('finds the start of a Sunday week', () => {
    expect(startOfWeek('2026-11-23', 0)).toBe('2026-11-22');
    expect(startOfWeek('2026-11-22', 0)).toBe('2026-11-22');
  });

  it('lists the seven nights of a week', () => {
    expect(weekDates('2026-11-25', 1)).toEqual([
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
      '2026-11-29',
    ]);
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-11-20', '2026-11-23')).toBe(3);
    expect(daysBetween('2026-11-23', '2026-11-20')).toBe(-3);
  });

  it("gives today's date in a time zone", () => {
    const instant = new Date('2026-11-24T03:00:00Z');
    expect(todayIn('UTC', instant)).toBe('2026-11-24');
    expect(todayIn('America/Los_Angeles', instant)).toBe('2026-11-23');
  });
});
