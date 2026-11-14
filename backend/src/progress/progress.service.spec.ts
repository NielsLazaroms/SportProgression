import {
  ProgressService,
  estimateOneRepMax,
  recordKind,
} from './progress.service';

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
};

function workout(id: string, date: string, sets: [number, number][]) {
  return {
    id,
    name: 'Push Day',
    date,
    createdAt: new Date(date),
    completedAt: new Date(date),
    exercises: [
      {
        id: Number(id),
        workoutId: id,
        exerciseDefinitionId: 1,
        name: 'Bench Press',
        muscleGroup: 'Chest',
        createdAt: new Date(date),
        sets: sets.map(([repsAmount, weightKg], i) => ({
          setId: Number(id) * 10 + i,
          setOrder: i + 1,
          repsAmount,
          weightKg,
        })),
      },
    ],
  };
}

describe('estimateOneRepMax', () => {
  it('returns the weight itself for a single rep', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });
  it('applies the Epley formula', () => {
    expect(estimateOneRepMax(60, 10)).toBeCloseTo(80);
  });
  it('ignores empty sets', () => {
    expect(estimateOneRepMax(60, 0)).toBe(0);
  });
});

describe('ProgressService', () => {
  const workouts = [
    workout('1', daysAgo(14), [[8, 60]]),
    workout('2', daysAgo(7), [[8, 62.5]]),
    workout('3', daysAgo(0), [[8, 60]]),
  ];
  const exercises = workouts.map((w) => ({ ...w.exercises[0], workout: w }));
  const service = new ProgressService(
    { find: jest.fn().mockResolvedValue(workouts) } as any,
    { find: jest.fn().mockResolvedValue(exercises) } as any,
  );

  it('summarises totals, streak and per-exercise trend', async () => {
    const summary = await service.summary('user');
    expect(summary.totals).toEqual({ workouts: 3, sets: 3, volumeKg: 1460 });
    expect(summary.thisWeek.workouts).toBeGreaterThanOrEqual(1);
    expect(summary.streakWeeks).toBe(3);
    expect(summary.weekly).toHaveLength(12);
    // Each of the three workouts trained chest once.
    expect(summary.muscleGroups).toEqual([
      { muscleGroup: 'Chest', workouts: 3 },
    ]);
    expect(summary.exercises).toHaveLength(1);
    expect(summary.exercises[0].bestWeightKg).toBe(62.5);
    expect(summary.exercises[0].trendPct).toBe(0);
    // Only the second session contained a record set (heavier than before).
    expect(summary.recentRecords.map((r) => r.workoutId)).toEqual(['2']);
  });

  it('leaves warm-up sets out of every statistic', async () => {
    const w = workout('9', daysAgo(1), [
      [10, 40],
      [5, 100],
    ]);
    (w.exercises[0].sets[0] as any).isWarmup = true;
    const svc = new ProgressService(
      { find: jest.fn().mockResolvedValue([w]) } as any,
      {
        find: jest
          .fn()
          .mockResolvedValue([{ ...w.exercises[0], workout: w }]),
      } as any,
    );
    const summary = await svc.summary('user');
    expect(summary.totals).toEqual({ workouts: 1, sets: 1, volumeKg: 500 });
    const history = await svc.exerciseHistory(1, 'user');
    expect(history.sessions[0].sets).toEqual([
      { setId: 91, reps: 5, weightKg: 100 },
    ]);
  });

  it('recognises weight and rep records, also for bodyweight', () => {
    const before = [
      { reps: 5, weightKg: 100 },
      { reps: 12, weightKg: 0 },
    ];
    expect(recordKind({ reps: 1, weightKg: 105 }, before)).toBe('weight');
    expect(recordKind({ reps: 6, weightKg: 100 }, before)).toBe('reps');
    expect(recordKind({ reps: 5, weightKg: 100 }, before)).toBeNull();
    expect(recordKind({ reps: 13, weightKg: 0 }, before)).toBe('reps');
    expect(recordKind({ reps: 12, weightKg: 0 }, before)).toBeNull();
    expect(recordKind({ reps: 5, weightKg: 100 }, [])).toBeNull();
  });

  it('counts every rep in the estimate, also above 12', () => {
    expect(estimateOneRepMax(60, 15)).toBeGreaterThan(estimateOneRepMax(60, 12));
  });

  it('builds chronological history with all-time records', async () => {
    const history = await service.exerciseHistory(1, 'user');
    expect(history.sessions.map((s) => s.workoutId)).toEqual(['1', '2', '3']);
    expect(history.sessions.map((s) => s.isPr)).toEqual([false, true, false]);
    expect(history.records.maxWeight?.weightKg).toBe(62.5);
    expect(history.records.bestE1rm?.workoutId).toBe('2');
  });
});
