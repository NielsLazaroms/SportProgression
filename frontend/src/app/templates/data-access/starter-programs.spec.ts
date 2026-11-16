import { STARTER_PROGRAMS, planFirstWeek } from './starter-programs';

const fullBody = STARTER_PROGRAMS.find((p) => p.id === 'full_body')!;
const upperLower = STARTER_PROGRAMS.find((p) => p.id === 'upper_lower')!;

describe('planFirstWeek', () => {
  it('uses the program days in the coming seven days and rotates A, B, A', () => {
    // 2026-11-19 is a Thursday: Friday, Monday and Wednesday follow.
    expect(planFirstWeek(fullBody, '2026-11-19', [])).toEqual([
      { date: '2026-11-20', workout: 0 },
      { date: '2026-11-23', workout: 1 },
      { date: '2026-11-25', workout: 0 },
    ]);
  });

  it('includes today when it is a training day', () => {
    // 2026-11-16 is a Monday.
    expect(planFirstWeek(fullBody, '2026-11-16', [])[0]).toEqual({ date: '2026-11-16', workout: 0 });
  });

  it('uses the preferred days when there are enough of them', () => {
    expect(planFirstWeek(fullBody, '2026-11-16', [6, 2, 4]).map((d) => d.date)).toEqual([
      '2026-11-17',
      '2026-11-19',
      '2026-11-21',
    ]);
  });

  it('falls back to the program days when too few are preferred', () => {
    expect(planFirstWeek(upperLower, '2026-11-16', [1, 3]).map((d) => d.date)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-19',
      '2026-11-20',
    ]);
  });

  it('only names exercises with sane targets', () => {
    for (const p of STARTER_PROGRAMS) {
      for (const w of p.workouts) {
        expect(w.exercises.length).toBeGreaterThanOrEqual(5);
        for (const e of w.exercises) {
          expect(e.sets).toBeGreaterThan(0);
          expect(e.reps).toBeGreaterThan(0);
        }
      }
    }
  });
});
