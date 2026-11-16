import { GoalKind } from '../goals/goal.entity';
import { GoalView } from '../goals/goals.service';
import { describeGoals, focusGroups } from './analysis.service';

const base = {
  targetDate: null,
  daysLeft: null,
  note: null,
  createdAt: new Date(),
};
const lift = (achieved: boolean): GoalView => ({
  ...base,
  id: achieved ? 'a' : 'b',
  kind: GoalKind.LIFT,
  exerciseDefinitionId: 1,
  exerciseName: 'Bench Press',
  muscleGroup: 'Chest',
  bodyweight: false,
  targetWeightKg: 100,
  targetReps: 5,
  progress: {
    pct: achieved ? 100 : 80,
    achieved,
    achievedOn: achieved ? '2026-11-01' : null,
    best: { reps: 5, weightKg: 80, date: '2026-11-01' },
  },
});
const back: GoalView = {
  ...base,
  id: 'c',
  kind: GoalKind.MUSCLE,
  muscleGroup: 'Back',
  targetSetsPerWeek: 14,
  targetDate: '2027-03-01',
  daysLeft: 105,
  note: 'wider back',
  progress: { pct: 43, setsThisWeek: 6, setsEarlierWeeks: [8, 9, 10, 12] },
};

describe('goals for the coach', () => {
  it('sends open goals in the log format and leaves reached ones out', () => {
    expect(describeGoals([lift(true), lift(false), back])).toEqual([
      {
        type: 'lift',
        exerciseId: 1,
        exercise: 'Bench Press',
        bodyweight: undefined,
        target: '5 x 100',
        bestSoFar: '5 x 80 (2026-11-01)',
        progressPct: 80,
        targetDate: undefined,
        daysLeft: undefined,
        note: undefined,
      },
      {
        type: 'muscleFocus',
        muscleGroup: 'Back',
        targetSetsPerWeek: 14,
        setsThisWeek: 6,
        targetDate: '2027-03-01',
        daysLeft: 105,
        note: 'wider back',
      },
    ]);
  });

  it('sends nothing without open goals', () => {
    expect(describeGoals([])).toBeUndefined();
    expect(describeGoals([lift(true)])).toBeUndefined();
  });

  it('lists the muscle groups with a goal', () => {
    expect([...focusGroups([lift(false), back])]).toEqual(['Back']);
  });
});
