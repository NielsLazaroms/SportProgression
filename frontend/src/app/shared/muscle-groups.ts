/**
 * Canonical muscle groups for strength exercises. The value stored on an
 * exercise is the canonical English key; the label shown to the user is
 * translated via the `muscle.<Key>` i18n keys.
 */
export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Legs',
  'Glutes',
  'Abs',
] as const;
