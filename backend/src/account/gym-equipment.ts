export type EquipmentGroup = 'free_weights' | 'stations' | 'legs' | 'upper';

/**
 * Common strength equipment a gym can have, as stable keys with the English
 * name the AI coach gets and the group the app shows it in. The app
 * translates the keys; anything else the user stores is the name of a
 * machine they typed themselves.
 */
export const EQUIPMENT_LIST: { key: string; label: string; group: EquipmentGroup }[] = [
  { key: 'barbell', label: 'Barbell and squat rack', group: 'free_weights' },
  { key: 'dumbbells', label: 'Dumbbells', group: 'free_weights' },
  { key: 'kettlebells', label: 'Kettlebells', group: 'free_weights' },
  { key: 'bench', label: 'Adjustable bench', group: 'free_weights' },
  { key: 'incline_decline_bench', label: 'Incline and decline bench press stations (benches with a barbell rack)', group: 'free_weights' },
  { key: 'cable', label: 'Cable station', group: 'stations' },
  { key: 'smith_machine', label: 'Smith machine', group: 'stations' },
  { key: 'pull_up_bar', label: 'Pull-up bar', group: 'stations' },
  { key: 'dip_station', label: 'Dip station', group: 'stations' },
  { key: 'back_extension', label: 'Back extension bench', group: 'stations' },
  { key: 'leg_press', label: 'Leg press', group: 'legs' },
  { key: 'hack_squat', label: 'Hack squat machine', group: 'legs' },
  { key: 'leg_extension', label: 'Leg extension machine', group: 'legs' },
  { key: 'leg_curl', label: 'Leg curl machine', group: 'legs' },
  { key: 'calf_raise', label: 'Calf raise machine', group: 'legs' },
  { key: 'hip_thrust', label: 'Hip thrust machine', group: 'legs' },
  { key: 'hip_abduction', label: 'Hip abduction machine', group: 'legs' },
  { key: 'hip_adduction', label: 'Hip adduction machine', group: 'legs' },
  { key: 'lat_pulldown', label: 'Lat pulldown machine', group: 'upper' },
  { key: 'seated_row', label: 'Seated row machine', group: 'upper' },
  { key: 'chest_press', label: 'Chest press machine', group: 'upper' },
  { key: 'pec_deck', label: 'Pec deck', group: 'upper' },
  { key: 'shoulder_press', label: 'Shoulder press machine', group: 'upper' },
  { key: 'biceps_curl', label: 'Biceps curl machine', group: 'upper' },
  { key: 'triceps_machine', label: 'Triceps extension machine', group: 'upper' },
  { key: 'ab_crunch', label: 'Ab crunch machine', group: 'upper' },
];

/** Key to the English name the AI coach gets. */
export const GYM_EQUIPMENT: Record<string, string> = Object.fromEntries(
  EQUIPMENT_LIST.map((e) => [e.key, e.label]),
);

/** Keeps known keys and typed names, trimmed, without doubles (case-insensitive). */
export function cleanEquipment(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const item = raw.trim().replace(/\s+/g, ' ');
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** The machines the user typed in themselves (not one of the common keys). */
export function customMachines(stored: string[] | null | undefined): string[] {
  return (stored ?? []).filter((item) => !(item in GYM_EQUIPMENT));
}

/** What the coach reads: English names, or undefined when the user set nothing (a full gym). */
export function describeEquipment(stored: string[] | null | undefined): string[] | undefined {
  const names = (stored ?? []).map((item) => GYM_EQUIPMENT[item] ?? item);
  return names.length ? names : undefined;
}
