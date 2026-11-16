import { ScheduledWorkout } from '../schedule/scheduled-workout.entity';
import { describePlanned, uncoveredGroups } from './analysis.service';

const exercise = (muscleGroup: string | null) => ({
  exerciseDefinitionId: 1,
  name: 'x',
  muscleGroup,
  bodyweight: false,
  targetSets: 3,
  targetReps: 8,
  targetWeightKg: null,
  supersetGroup: null,
});

describe('planned workouts for the coach', () => {
  it('gives date, weekday, name and each muscle group once', () => {
    const items = [
      {
        date: '2026-11-18',
        name: 'Pull Day',
        exercises: [
          exercise('Back'),
          exercise('Back'),
          exercise('Biceps'),
          exercise(null),
        ],
      },
    ] as ScheduledWorkout[];
    expect(describePlanned(items)).toEqual([
      {
        date: '2026-11-18',
        weekday: 'Wednesday',
        name: 'Pull Day',
        muscleGroups: ['Back', 'Biceps'],
      },
    ]);
  });

  it('sends nothing when nothing is planned', () => {
    expect(describePlanned([])).toBeUndefined();
  });
});

describe('uncovered muscle groups in a week', () => {
  const groups = [
    { group: 'Chest' },
    { group: 'Back' },
    { group: 'Abs' },
    { group: 'Glutes', skippedOnPurpose: true },
  ];
  it('lists the groups the lifter trains that no exercise works', () => {
    const days = [
      { exercises: [{ muscleGroup: 'Chest' }, { muscleGroup: null }] },
    ];
    expect(uncoveredGroups(groups, days)).toEqual(['Back', 'Abs']);
  });
  it('is empty for a complete week', () => {
    const days = [
      {
        exercises: [
          { muscleGroup: 'Chest' },
          { muscleGroup: 'Back' },
          { muscleGroup: 'Abs' },
        ],
      },
    ];
    expect(uncoveredGroups(groups, days)).toEqual([]);
  });
});
