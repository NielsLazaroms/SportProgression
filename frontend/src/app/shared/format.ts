/** Human date/volume formatting shared across workout views. */

type Translator = (key: string, params?: Record<string, string | number>) => string;

/**
 * "Today" / "Yesterday" / "3 days ago" / "Mon 24 Oct" from a yyyy-mm-dd string.
 * Pass a translator + locale for localized output; falls back to English.
 */
export function relativeDay(
  dateStr: string,
  t?: Translator,
  locale = 'en',
): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  const tr: Translator = t ?? ((k) => k);

  if (diffDays === 0) return tr('date.today');
  if (diffDays === 1) return tr('date.yesterday');
  if (diffDays > 1 && diffDays < 7) return tr('date.daysAgo', { n: diffDays });

  return date.toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** "14:30" from an ISO timestamp. */
export function timeOfDay(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 12432 -> "12.4k", 850 -> "850". */
export function compactKg(kg: number): string {
  if (kg <= 0) return '—';
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k`;
  return Math.round(kg).toString();
}
