/** Calendar helpers on plain yyyy-mm-dd strings (no time zones involved). */

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 1 = Monday ... 7 = Sunday. */
export function weekdayOf(day: string): number {
  const d = new Date(`${day}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/**
 * Puts the days of a weekly plan on dates, in the order of the plan,
 * starting today at the earliest:
 *  - each day goes on the first matching weekday after the day before it,
 *    so a week accepted on Thursday lands on next Monday, Wednesday, Friday;
 *  - the whole plan stays within 7 days of its first date; a day whose
 *    weekday does not fit (out of order, twice the same) takes the next day;
 *  - without any weekdays it follows the preferred training days, or else
 *    leaves a rest day between sessions.
 */
export function assignDates(
  weekdays: (number | null | undefined)[],
  today: string,
  preferred: number[] = [],
): string[] {
  const valid = (n: number | null | undefined): n is number =>
    typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 7;

  if (!weekdays.some(valid)) {
    const days = [...new Set(preferred.filter(valid))];
    if (!days.length) return weekdays.map((_, i) => addDays(today, i * 2));
    const out: string[] = [];
    for (let d = today; out.length < weekdays.length; d = addDays(d, 1)) {
      if (days.includes(weekdayOf(d))) out.push(d);
    }
    return out;
  }

  const out: string[] = [];
  let cursor = today;
  let last: string | null = null;
  for (const w of weekdays) {
    // The latest date this plan day may take: 6 days after the first one.
    const limit = out.length ? addDays(out[0], 6) : addDays(today, 6);
    let date: string | null = null;
    if (valid(w)) {
      for (let d = cursor; d <= limit; d = addDays(d, 1)) {
        if (weekdayOf(d) === w) {
          date = d;
          break;
        }
      }
    }
    date ??= cursor;
    out.push(date);
    last = date;
    cursor = addDays(last, 1);
  }
  return out;
}
