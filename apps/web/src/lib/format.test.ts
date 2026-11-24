import { describe, expect, it } from 'vitest';
import { lastEaten, memberName, monthDay, weekdayName, weekRange } from './format';

describe('date formatting', () => {
  it('formats a night without shifting it by time zone', () => {
    expect(weekdayName('2026-11-24')).toBe('Tuesday');
    expect(monthDay('2026-11-24')).toBe('Nov 24');
  });

  it('formats a week range', () => {
    expect(weekRange('2026-11-23', '2026-11-29')).toBe('Nov 23 – 29');
    expect(weekRange('2026-11-30', '2026-12-06')).toBe('Nov 30 – Dec 6');
  });

  it('says how long ago a meal was eaten', () => {
    expect(lastEaten(null, '2026-11-24')).toBe('never');
    expect(lastEaten('2026-11-23', '2026-11-24')).toBe('yesterday');
    expect(lastEaten('2026-11-14', '2026-11-24')).toBe('10 days ago');
    expect(lastEaten('2026-10-20', '2026-11-24')).toBe('5 weeks ago');
  });

  it('names members', () => {
    expect(memberName({ userId: 'a', displayName: 'Sam' }, 'b')).toBe('Sam');
    expect(memberName({ userId: 'a', displayName: null }, 'a')).toBe('You');
    expect(memberName({ userId: 'b', displayName: null }, 'a')).toBe('Partner');
  });
});
