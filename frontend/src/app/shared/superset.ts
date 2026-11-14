/**
 * Supersets on the client. A superset is a run of ADJACENT exercises that
 * share the same `supersetGroup` number; the server normalises on save (only
 * runs of two or more neighbours survive), these helpers mirror that so the
 * UI can show the result immediately.
 */
export interface Groupable {
  supersetGroup?: number | null;
}

/** Position of an item inside its superset, or null when it stands alone. */
export type SupersetRole = 'first' | 'middle' | 'last' | null;

/** Role of the item at `index`, looking at its neighbours. */
export function supersetRole(items: Groupable[], index: number): SupersetRole {
  const g = items[index]?.supersetGroup;
  if (g == null) return null;
  const prev = index > 0 && items[index - 1].supersetGroup === g;
  const next = index < items.length - 1 && items[index + 1].supersetGroup === g;
  if (prev && next) return 'middle';
  if (next) return 'first';
  if (prev) return 'last';
  return null;
}

/** Indices of the superset the item at `index` belongs to (just itself if none). */
export function supersetMembers(items: Groupable[], index: number): number[] {
  if (supersetRole(items, index) === null) return [index];
  const g = items[index].supersetGroup;
  let start = index;
  while (start > 0 && items[start - 1].supersetGroup === g) start--;
  let end = index;
  while (end < items.length - 1 && items[end + 1].supersetGroup === g) end++;
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/** Same rule as the server: keep adjacent runs of 2+, renumber 1, 2, 3… */
export function normalizeSupersets(groups: (number | null | undefined)[]): (number | null)[] {
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

/**
 * Links the item at `index` with the one after it (joining/merging whatever
 * supersets they were in). Returns the new group numbers for all items.
 */
export function linkWithNext(items: Groupable[], index: number): (number | null)[] {
  const groups = items.map((i) => i.supersetGroup ?? null);
  if (index < 0 || index >= items.length - 1) return normalizeSupersets(groups);
  const fresh = Math.max(0, ...groups.map((g) => g ?? 0)) + 1;
  const a = supersetMembers(items, index);
  const b = supersetMembers(items, index + 1);
  for (const k of [...a, ...b]) groups[k] = fresh;
  return normalizeSupersets(groups);
}

/** Takes the item at `index` out of its superset (the rest stays linked where still adjacent). */
export function unlink(items: Groupable[], index: number): (number | null)[] {
  const groups = items.map((i) => i.supersetGroup ?? null);
  const members = supersetMembers(items, index);
  if (members.length < 2) return normalizeSupersets(groups);
  // Splitting in the middle leaves two separate runs: give the tail its own number.
  const fresh = Math.max(0, ...groups.map((g) => g ?? 0)) + 1;
  for (const k of members) if (k > index) groups[k] = fresh;
  groups[index] = null;
  return normalizeSupersets(groups);
}

/** "A", "B", "C"… for the item's place inside its superset; null when it stands alone. */
export function supersetLetter(items: Groupable[], index: number): string | null {
  if (supersetRole(items, index) === null) return null;
  const place = index - supersetMembers(items, index)[0];
  return String.fromCharCode(65 + (place % 26));
}

/**
 * The list cut into consecutive pieces: every superset as one piece of 2+
 * items, every other item as a piece of its own. For compact previews.
 */
export function supersetRuns<T extends Groupable>(items: T[]): T[][] {
  const out: T[][] = [];
  let i = 0;
  while (i < items.length) {
    const members = supersetMembers(items, i);
    out.push(members.map((k) => items[k]));
    i = members[members.length - 1] + 1;
  }
  return out;
}
