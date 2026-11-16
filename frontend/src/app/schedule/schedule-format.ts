import { MnLanguageService } from 'mn-angular-lib';
import { formatKg } from '../shared/format';
import { addDays } from './schedule-dates';
import { ScheduledExercise, ScheduleStatus } from './schedule.model';

/** "Today", "Tomorrow" or "wed 18 nov". */
export function scheduleDay(date: string, today: string, lang: MnLanguageService): string {
  if (date === today) return lang.t('schedule.today');
  if (date === addDays(today, 1)) return lang.t('schedule.tomorrow');
  if (date === addDays(today, -1)) return lang.t('schedule.yesterday');
  return new Date(`${date}T00:00:00`).toLocaleDateString(lang.locale === 'nl' ? 'nl-NL' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** "3 × 8 · 70 kg" ("+10 kg" for extra weight on bodyweight work). */
export function scheduleTarget(ex: ScheduledExercise, lang: MnLanguageService): string {
  const base = `${ex.targetSets} × ${ex.targetReps}`;
  if (ex.targetWeightKg == null || !(ex.targetWeightKg > 0)) return base;
  const kg = `${formatKg(ex.targetWeightKg, lang.locale)} ${lang.t('unit.kg')}`;
  return `${base} · ${ex.bodyweight ? '+' : ''}${kg}`;
}

export function statusKey(status: ScheduleStatus): string {
  return 'schedule.status.' + status;
}
