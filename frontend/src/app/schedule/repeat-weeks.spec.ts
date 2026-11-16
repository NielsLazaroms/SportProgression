import { repeatWeeks } from './schedule.model';

const week = [
  { date: '2026-11-16', name: 'Push', exercises: [{ exerciseDefinitionId: 1, targetSets: 4, targetReps: 5, targetWeightKg: 70 }] },
  { date: '2026-11-18', name: 'Pull', exercises: [{ exerciseDefinitionId: 2, targetSets: 4, targetReps: 8 }] },
];

describe('repeatWeeks', () => {
  it('keeps one week as it is', () => {
    expect(repeatWeeks(week, 1)).toEqual(week);
  });

  it('copies the week 7 days later and drops the weights after the first week', () => {
    const out = repeatWeeks(week, 3);
    expect(out.map((i) => i.date)).toEqual([
      '2026-11-16', '2026-11-18', '2026-11-23', '2026-11-25', '2026-11-30', '2026-12-02',
    ]);
    expect(out[0].exercises[0].targetWeightKg).toBe(70);
    expect(out[2].exercises[0]).toEqual({ exerciseDefinitionId: 1, targetSets: 4, targetReps: 5 });
  });
});
