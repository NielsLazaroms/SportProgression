import { describeRequest, focusTask } from './analysis.service';

describe('what the lifter asked the planner for', () => {
  it('is left out when nothing was asked', () => {
    expect(describeRequest()).toBeUndefined();
    expect(describeRequest({ note: '   ' })).toBeUndefined();
  });

  it('names the muscle groups of the focus and keeps the note', () => {
    expect(describeRequest({ focus: 'push', note: ' short session ' })).toEqual(
      {
        focus: 'push: Chest, Shoulders and Triceps',
        note: 'short session',
      },
    );
    expect(describeRequest({ note: 'no deadlifts' })).toEqual({
      note: 'no deadlifts',
    });
  });

  it('lets the focus decide a workout, and only weigh on a week', () => {
    expect(focusTask('legs', 'workout')).toContain('leg session');
    expect(focusTask('legs', 'workout')).toContain('This decides the session');
    expect(focusTask('pull', 'week')).toContain('extra focus on pull work');
    expect(focusTask('pull', 'week')).toContain('stay covered');
  });
});
