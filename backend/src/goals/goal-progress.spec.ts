import { liftProgress, muscleProgress, weeklySets } from './goal-progress';

const set = (reps: number, weightKg: number, date = '2026-11-02') => ({
  reps,
  weightKg,
  date,
});

describe('liftProgress', () => {
  it('is achieved by one set at the target weight and reps', () => {
    const p = liftProgress(
      { weightKg: 100, reps: 5 },
      [
        set(5, 95, '2026-10-01'),
        set(6, 100, '2026-10-20'),
        set(5, 100, '2026-11-01'),
      ],
      false,
    );
    expect(p).toMatchObject({
      achieved: true,
      pct: 100,
      achievedOn: '2026-10-20',
    });
  });

  it('stays below 100 when only the estimate beats the target', () => {
    // 80 x 10 is about 107 kg on paper, but 100 x 1 was never lifted.
    const p = liftProgress({ weightKg: 100, reps: 1 }, [set(10, 80)], false);
    expect(p.achieved).toBe(false);
    expect(p.pct).toBe(99);
  });

  it('scores weighted lifts by estimated 1RM', () => {
    const p = liftProgress(
      { weightKg: 100, reps: 5 },
      [set(5, 75), set(5, 50)],
      false,
    );
    expect(p.pct).toBe(75);
    expect(p.best).toMatchObject({ reps: 5, weightKg: 75 });
  });

  it('scores bodyweight goals by reps, scaled by the extra weight', () => {
    expect(
      liftProgress({ weightKg: 0, reps: 20 }, [set(15, 0)], true).pct,
    ).toBe(75);
    // +10 kg of a +20 kg target, all 5 reps: half way.
    expect(
      liftProgress({ weightKg: 20, reps: 5 }, [set(5, 10)], true).pct,
    ).toBe(50);
    expect(
      liftProgress({ weightKg: 0, reps: 20 }, [set(21, 0)], true).achieved,
    ).toBe(true);
  });

  it('has nothing to show without sets', () => {
    expect(liftProgress({ weightKg: 100, reps: 5 }, [], false)).toEqual({
      pct: 0,
      achieved: false,
      achievedOn: null,
      best: null,
    });
  });
});

describe('weeklySets / muscleProgress', () => {
  it('buckets sets into Monday weeks, this week last', () => {
    const weeks = weeklySets(
      [
        { date: '2026-11-16', sets: 4 }, // this week (Monday)
        { date: '2026-11-22', sets: 3 }, // this week (Sunday)
        { date: '2026-11-15', sets: 5 }, // last week (Sunday)
        { date: '2026-10-19', sets: 2 }, // four weeks back
        { date: '2026-10-18', sets: 9 }, // outside the window
      ],
      '2026-11-16',
      4,
    );
    expect(weeks).toEqual([2, 0, 0, 5, 7]);
    expect(muscleProgress(14, weeks)).toEqual({
      pct: 50,
      setsThisWeek: 7,
      setsEarlierWeeks: [2, 0, 0, 5],
    });
  });

  it('caps the bar at 100', () => {
    expect(muscleProgress(5, [0, 0, 0, 0, 12]).pct).toBe(100);
  });
});
