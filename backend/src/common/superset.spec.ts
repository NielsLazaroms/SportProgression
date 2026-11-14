import { normalizeSupersets } from './superset';

describe('normalizeSupersets', () => {
  it('keeps adjacent runs and renumbers them', () => {
    expect(normalizeSupersets([null, 7, 7, null, 3, 3, 3])).toEqual([
      null, 1, 1, null, 2, 2, 2,
    ]);
  });
  it('drops members that are no longer neighbours', () => {
    expect(normalizeSupersets([5, null, 5])).toEqual([null, null, null]);
  });
  it('splits two runs that reuse one number', () => {
    expect(normalizeSupersets([1, 1, null, 1, 1])).toEqual([1, 1, null, 2, 2]);
  });
  it('does not treat neighbours without a group as a superset', () => {
    expect(normalizeSupersets([null, null, undefined])).toEqual([
      null, null, null,
    ]);
  });
});
