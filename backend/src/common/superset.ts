/**
 * A superset is a run of ADJACENT exercises done back to back (a set of A,
 * then a set of B, repeat). It is stored as the same `supersetGroup` number on
 * each member. This normalises a requested arrangement: only runs of two or
 * more neighbours with the same group survive, renumbered 1, 2, 3… in order.
 */
export function normalizeSupersets(
  groups: (number | null | undefined)[],
): (number | null)[] {
  const out: (number | null)[] = groups.map(() => null);
  let next = 1;
  let i = 0;
  while (i < groups.length) {
    const g = groups[i];
    let j = i + 1;
    if (g != null) {
      while (j < groups.length && groups[j] === g) j++;
      if (j - i >= 2) {
        for (let k = i; k < j; k++) out[k] = next;
        next++;
      }
    }
    i = j;
  }
  return out;
}
