import { ScheduledWorkout } from '../schedule/scheduled-workout.entity';
import { describePlanned, legPart, missingGoalLifts, thinGroups, uncoveredGroups } from './analysis.service';

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

describe('muscles with too few sets in a week', () => {
  const ex = (name: string, muscleGroup: string, sets: number) => ({ name, muscleGroup, sets });
  const groups = [{ group: 'Chest' }, { group: 'Back' }, { group: 'Legs' }, { group: 'Biceps' }];

  it('warns for chest and back under 8 sets, with the count', () => {
    const days = [{ exercises: [ex('Bench Press', 'Chest', 6), ex('Barbell Row', 'Back', 9)] }];
    expect(thinGroups(groups, days)).toEqual([{ group: 'Chest', sets: 6 }]);
  });

  it('judges quads and hamstrings on their own, counting a hinge filed under Glutes', () => {
    const days = [
      {
        exercises: [
          ex('Leg Press', 'Legs', 3),
          ex('Hack Squat', 'Legs', 3),
          ex('Leg Extension', 'Legs', 3),
          ex('Leg Curl', 'Legs', 3),
          ex('Calf Raise', 'Legs', 6),
        ],
      },
    ];
    // 18 leg sets, but only 3 for the hamstrings
    expect(thinGroups([{ group: 'Legs' }], days)).toEqual([{ group: 'Hamstrings', sets: 3 }]);
    days[0].exercises.push(ex('Romanian Deadlift', 'Glutes', 5));
    expect(thinGroups([{ group: 'Legs' }], days)).toEqual([]);
  });

  it('does not judge quads and hamstrings when the week has a leg exercise it cannot place', () => {
    const days = [{ exercises: [ex('Leg Press', 'Legs', 3), ex('Belt Squat', 'Legs', 3)] }];
    expect(thinGroups([{ group: 'Legs' }], days)).toEqual([]);
  });

  it('asks less of a two day week', () => {
    const days = [{ exercises: [ex('Bench Press', 'Chest', 6)] }];
    expect(thinGroups([{ group: 'Chest' }], days, [], 2)).toEqual([]);
    expect(thinGroups([{ group: 'Chest' }], days, [], 3)).toEqual([{ group: 'Chest', sets: 6 }]);
  });

  it('leaves out small groups, skipped groups and groups with no work', () => {
    const days = [{ exercises: [ex('Barbell Curl', 'Biceps', 2), ex('Barbell Row', 'Back', 9)] }];
    expect(thinGroups([...groups, { group: 'Glutes', skippedOnPurpose: true }], days)).toEqual([]);
  });

  it('checks a muscle focus goal against its own target, also for Legs as a whole', () => {
    const days = [
      { exercises: [ex('Barbell Row', 'Back', 10), ex('Barbell Curl', 'Biceps', 4), ex('Squat', 'Legs', 8), ex('Leg Curl', 'Legs', 8)] },
    ];
    const focus = [
      { muscleGroup: 'Back', targetSetsPerWeek: 14 },
      { muscleGroup: 'Biceps', targetSetsPerWeek: 8 },
      { muscleGroup: 'Legs', targetSetsPerWeek: 20 },
    ];
    expect(thinGroups(groups, days, focus)).toEqual([
      { group: 'Back', sets: 10, target: 14 },
      { group: 'Legs', sets: 16, target: 20 },
      { group: 'Biceps', sets: 4, target: 8 },
    ]);
  });
});

describe('leg muscles of the starter exercises', () => {
  it('knows the main leg exercises, whatever the case', () => {
    expect(legPart('leg press')).toBe('quads');
    expect(legPart('Romanian Deadlift')).toBe('hamstrings');
    expect(legPart('Calf Raise')).toBe('calves');
    expect(legPart('Bench Press')).toBeUndefined();
  });
});

describe('lift goals missing from a week', () => {
  it('lists the goal exercises no day plans, once each', () => {
    const goals = [
      { exerciseDefinitionId: 1, exerciseName: 'Bench Press' },
      { exerciseDefinitionId: 2, exerciseName: 'Squat' },
      { exerciseDefinitionId: 2, exerciseName: 'Squat' },
    ];
    const days = [{ exercises: [{ exerciseDefinitionId: 1 }] }];
    expect(missingGoalLifts(goals, days)).toEqual(['Squat']);
  });
});
