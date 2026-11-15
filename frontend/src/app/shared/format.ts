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

const intlLocale = (locale: string) => (locale === 'nl' ? 'nl-NL' : 'en-GB');

/**
 * A plain number in the user's language: 67.5 -> "67.5" (en) / "67,5" (nl),
 * 60 -> "60". Use this for every weight/number shown as text so the decimal
 * mark is the same on every screen.
 */
export function formatNumber(n: number | string, locale = 'en', maxDecimals = 2): string {
  const value = Number(n);
  if (!Number.isFinite(value)) return '';
  return value.toLocaleString(intlLocale(locale), {
    maximumFractionDigits: maxDecimals,
    useGrouping: false,
  });
}

/** Compact volume WITHOUT unit: 12432 -> "12.4k", 850 -> "850", 0 -> "0". */
export function compactKg(kg: number, locale = 'en'): string {
  if (!(kg > 0)) return '0';
  if (kg >= 1000) {
    // Round on integers (1650 -> 1.7k) instead of trusting float toFixed.
    return `${formatNumber(Math.round(kg / 100) / 10, locale, 1)}k`;
  }
  return Math.round(kg).toString();
}

/**
 * i18n key for a count: `plural(1, 'unit.sets')` -> 'unit.sets.one',
 * otherwise the key itself. The `.one` variant must exist in the dictionaries.
 */
export function plural(n: number, key: string): string {
  return n === 1 ? `${key}.one` : key;
}

/**
 * i18n key for the second line of an error toast, by cause: offline, rate
 * limited, or a generic "try again". Pass the HttpErrorResponse.
 */
export function errorHintKey(err: unknown): string {
  const status = (err as { status?: number } | null)?.status;
  if (status === 0) return 'toast.offline';
  if (status === 429) return 'toast.rateLimited';
  return 'toast.retry';
}

/** "24 Oct" (or "24 Oct 2026" with `withYear`) from a yyyy-mm-dd string. */
export function shortDate(dateStr: string, locale = 'en', withYear = false): string {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(
    locale === 'nl' ? 'nl-NL' : 'en-GB',
    { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) },
  );
}

/** Weight with at most one decimal, localized: 67.5 -> "67.5" / "67,5", 100 -> "100". */
export function formatKg(kg: number, locale = 'en'): string {
  return formatNumber(kg, locale, 1);
}

/** Today's date in the user's own timezone as yyyy-mm-dd (not UTC). */
export function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
