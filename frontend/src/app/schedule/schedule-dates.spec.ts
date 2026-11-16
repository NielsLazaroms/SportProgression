import { addDays, assignDates, weekdayOf } from './schedule-dates';

// 2026-11-16 is a Monday, 2026-11-19 a Thursday.
const MON = '2026-11-16';
const THU = '2026-11-19';

describe('weekdayOf / addDays', () => {
  it('numbers Monday 1 to Sunday 7', () => {
    expect(weekdayOf(MON)).toBe(1);
    expect(weekdayOf('2026-11-22')).toBe(7);
    expect(addDays(MON, 7)).toBe('2026-11-23');
  });
});

describe('assignDates', () => {
  it('uses today when the first day is today', () => {
    expect(assignDates([1, 3, 5], MON)).toEqual(['2026-11-16', '2026-11-18', '2026-11-20']);
  });

  it('keeps the order: accepted on Thursday, the week starts next Monday', () => {
    expect(assignDates([1, 3, 5], THU)).toEqual(['2026-11-23', '2026-11-25', '2026-11-27']);
  });

  it('starts this week when the first day is still to come', () => {
    expect(assignDates([5, 7], THU)).toEqual(['2026-11-20', '2026-11-22']);
  });

  it('gives a weekday that no longer fits in the week the next free day', () => {
    expect(assignDates([3, 3], MON)).toEqual(['2026-11-18', '2026-11-19']);
    // Monday still fits within the week that started on Friday.
    expect(assignDates([5, 1], MON)).toEqual(['2026-11-20', '2026-11-23']);
    expect(assignDates([5, 4], MON)).toEqual(['2026-11-20', '2026-11-26']);
  });

  it('fills a missing weekday with the next day', () => {
    expect(assignDates([1, null, 5], MON)).toEqual(['2026-11-16', '2026-11-17', '2026-11-20']);
  });

  it('falls back to the preferred days, then to every other day', () => {
    expect(assignDates([null, null, null], THU, [1, 4, 6])).toEqual([
      '2026-11-19',
      '2026-11-21',
      '2026-11-23',
    ]);
    expect(assignDates([undefined, undefined], MON)).toEqual(['2026-11-16', '2026-11-18']);
  });
});
