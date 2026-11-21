import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ActionStyle,
  ConfirmationTone,
  MnAlertService,
  MnLanguageService,
  MnModalService,
  MnTranslatePipe,
  KeyboardMode,
  ModalBuilder,
} from 'mn-angular-lib';
import { AppIcon } from '../../../shared/app-icon';
import { AppHeader } from '../../../layout/app-header';
import { AuthService, WEIGHT_STEPS, WEIGHT_STEP_MAX, WEIGHT_STEP_MIN } from '../../../auth/data-access/auth.service';
import { FormsModule } from '@angular/forms';
import { DecimalInput } from '../../../workouts/components/decimal-input';
import { ProgressService } from '../../../progress/data-access/progress.service';
import { compactKg, errorHintKey, formatKg, formatNumber, todayIso } from '../../../shared/format';
import { AnalysisService, MuscleGroupChoice } from '../../../analysis/analysis.service';
import { ThemeChoice, ThemeService } from '../../../shared/theme.service';
import { AccountExport, exportToCsv, exportToPdf } from '../../export-formats';

type Locale = 'en' | 'nl';
type ExportFormat = 'csv' | 'pdf';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [AppHeader, RouterLink, AppIcon, MnTranslatePipe, FormsModule, DecimalInput],
  templateUrl: './profile-page.html',
})
export class ProfilePage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly progressService = inject(ProgressService);
  private readonly lang = inject(MnLanguageService);
  private readonly theme = inject(ThemeService);
  private readonly alerts = inject(MnAlertService);
  private readonly modal = inject(MnModalService);
  private readonly analysis = inject(AnalysisService);

  readonly canUseAi = this.auth.canUseAi;
  /** Preferred training days (1 = Monday ... 7 = Sunday) and the note for the AI coach. */
  readonly weekdays = [1, 2, 3, 4, 5, 6, 7];
  readonly trainingDays = signal<number[]>([]);
  readonly coachNote = signal('');
  readonly coachLoaded = signal(false);
  readonly coachAnnouncement = signal('');
  /** What the server has, so an unchanged note is not saved again on blur. */
  private coachSaved = '';

  /** Muscle groups with whether the user trains them, for the row that opens the muscle groups page. */
  readonly muscleGroups = signal<MuscleGroupChoice[]>([]);

  /** The user's gym in short, for the row that opens My gym; null until loaded. */
  readonly gym = signal<{ name: string; count: number } | null>(null);

  /** The format being prepared, or null. */
  readonly exporting = signal<ExportFormat | null>(null);
  readonly deleting = signal(false);

  readonly profile = this.auth.profile;
  readonly displayName = this.auth.displayName;
  readonly locale = signal(this.lang.locale);

  /** Each language is named in that language, whatever the current one is. */
  readonly languages: { code: Locale; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'nl', label: 'Nederlands' },
  ];

  readonly themeChoice = this.theme.choice;
  readonly themes: { id: ThemeChoice; label: string; icon: string }[] = [
    { id: 'system', label: 'profile.theme.system', icon: 'monitor' },
    { id: 'light', label: 'profile.theme.light', icon: 'sun' },
    { id: 'dark', label: 'profile.theme.dark', icon: 'moon' },
  ];

  /** Same totals as the Progress page (workouts that have logged sets). */
  readonly workoutCount = signal<number | null>(null);
  readonly lifetimeVolume = signal<number | null>(null);

  readonly initials = computed(() => {
    const p = this.profile();
    if (!p) return '';
    const a = p.firstName?.[0] ?? p.email?.[0] ?? '';
    const b = p.lastName?.[0] ?? '';
    return (a + b).toUpperCase();
  });

  ngOnInit(): void {
    if (!this.profile()) {
      this.auth.checkAuth().subscribe();
    }
    // Optional section: without the list it simply stays hidden.
    this.analysis.coachPreferences().subscribe({
      next: (p) => {
        this.trainingDays.set(p.trainingDays);
        this.coachNote.set(p.note);
        this.coachSaved = JSON.stringify(p);
        this.coachLoaded.set(true);
      },
      // Optional section: it stays hidden when it cannot be loaded.
      error: () => undefined,
    });
    this.analysis.myGym().subscribe({
      next: (g) => this.gym.set({ name: g.name, count: g.items.filter((i) => i.owned).length }),
      // Optional section: it stays hidden when it cannot be loaded.
      error: () => undefined,
    });
    this.analysis.muscleGroups().subscribe({
      next: (groups) => this.muscleGroups.set(groups),
      error: () => undefined,
    });
    this.progressService.getSummary().subscribe({
      next: (s) => {
        this.workoutCount.set(s.totals?.workouts ?? 0);
        this.lifetimeVolume.set(s.totals?.volumeKg ?? 0);
      },
      // Unknown stays "-": a made-up 0 would be wrong.
      error: () => undefined,
    });
  }

  toggleDay(day: number): void {
    const days = this.trainingDays();
    this.trainingDays.set(
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b),
    );
    this.saveCoach();
  }

  /** Saves days and note when something changed (chips save at once, the note on leaving the field). */
  saveCoach(): void {
    const prefs = { trainingDays: this.trainingDays(), note: this.coachNote().trim().slice(0, 300) };
    const wanted = JSON.stringify(prefs);
    if (wanted === this.coachSaved) return;
    const before = this.coachSaved;
    this.coachSaved = wanted;
    this.analysis.setCoachPreferences(prefs).subscribe({
      next: () => this.coachAnnouncement.set(this.lang.t('profile.coach.saved')),
      error: (err) => {
        this.coachSaved = before;
        this.alerts.error(this.lang.t('profile.coach.err'), this.lang.t(errorHintKey(err)));
      },
    });
  }

  muscleLabel(name: string): string {
    return this.lang.translateIfPresent('muscle.' + name) ?? name;
  }

  /** "All trained", or which groups are skipped on purpose. */
  musclesSummary(): string {
    const skipped = this.muscleGroups().filter((g) => !g.trained).map((g) => this.muscleLabel(g.name));
    if (!skipped.length) return this.lang.t('profile.muscles.all');
    return this.lang.t('profile.muscles.skipped', { groups: skipped.join(', ') });
  }

  /** "040FIT Heeze, 19 items", or a nudge to set it up. */
  gymSummary(): string {
    const g = this.gym();
    if (!g) return '';
    if (!g.count) return this.lang.t('profile.gym.notSet');
    const items = this.lang.t(g.count === 1 ? 'profile.gym.items.one' : 'profile.gym.items', { n: this.countText(g.count) });
    return g.name ? `${g.name}, ${items}` : items;
  }

  /** "38 workouts, 245k kg moved": the all-time totals as one line under the name. */
  totalsLine(): string {
    const n = this.workoutCount();
    if (n === null) return '';
    const parts = [this.lang.t(n === 1 ? 'profile.totals.workouts.one' : 'profile.totals.workouts', { n: this.countText(n) })];
    const kg = this.lifetimeVolume();
    if (kg) parts.push(this.lang.t('profile.totals.volume', { v: this.volumeText(kg) }));
    return parts.join(', ');
  }

  countText(n: number): string {
    return formatNumber(n, this.lang.locale, 0);
  }

  volumeText(kg: number): string {
    return compactKg(kg, this.lang.locale);
  }

  async setLanguage(code: Locale): Promise<void> {
    if (this.lang.locale === code) return;
    try {
      localStorage.setItem('locale', code);
    } catch {
      /* storage unavailable: the choice lasts for this visit only */
    }
    await this.lang.setLocale(code);
    this.locale.set(code);
  }

  setTheme(choice: ThemeChoice): void {
    this.theme.setChoice(choice);
  }

  readonly weightSteps = WEIGHT_STEPS;
  readonly weightStep = this.auth.weightStep;
  /** The saved step is none of the presets. */
  readonly customStep = computed(() => !WEIGHT_STEPS.includes(this.weightStep()));
  /** The custom field is shown: the user tapped Custom, or a custom step is saved. */
  readonly customOpen = signal(false);
  readonly showCustom = computed(() => this.customOpen() || this.customStep());
  /** What is typed in the custom field; null while empty or not a number. */
  readonly customDraft = signal<number | null>(null);
  readonly stepMin = WEIGHT_STEP_MIN;
  readonly stepMax = WEIGHT_STEP_MAX;

  pickPreset(kg: number): void {
    this.customOpen.set(false);
    this.setWeightStep(kg);
  }

  /** The saved step when it is a custom one; null (an empty field) while a preset is chosen. */
  readonly savedCustom = computed(() => (this.customStep() ? this.weightStep() : null));
  readonly customPlaceholder = computed(() => formatNumber(1.25, this.lang.locale, 2));

  /** Opens the field empty (or with the saved custom step) and puts the cursor in it. */
  openCustom(): void {
    this.customDraft.set(this.savedCustom());
    this.customOpen.set(true);
    setTimeout(() => document.getElementById('step-custom')?.focus());
  }

  /** Saves the typed step when it is a valid one; otherwise says what is allowed. */
  saveCustom(): void {
    const raw = this.customDraft();
    if (raw == null) return;
    const kg = Math.round(raw * 100) / 100;
    if (kg < WEIGHT_STEP_MIN || kg > WEIGHT_STEP_MAX) {
      this.alerts.error(
        this.lang.t('profile.weightStep.err'),
        this.lang.t('profile.weightStep.range', {
          min: formatKg(WEIGHT_STEP_MIN, this.lang.locale),
          max: formatKg(WEIGHT_STEP_MAX, this.lang.locale),
        }),
      );
      this.customDraft.set(this.savedCustom());
      return;
    }
    this.customDraft.set(kg);
    this.setWeightStep(kg);
  }

  /** "0.5" / "0,5": a step as the user's language writes it. */
  stepLabel(kg: number): string {
    return formatKg(kg, this.lang.locale);
  }

  setWeightStep(kg: number): void {
    if (this.weightStep() === kg) return;
    this.auth.setWeightStep(kg).subscribe({
      error: (err: unknown) =>
        this.alerts.error(this.lang.t('profile.weightStep.err'), this.lang.t(errorHintKey(err))),
    });
  }

  readonly exportFormats: ExportFormat[] = ['csv', 'pdf'];

  /** Downloads my data: CSV (every set, for a spreadsheet) or PDF (a readable training log). */
  exportData(format: ExportFormat): void {
    if (this.exporting()) return;
    this.exporting.set(format);
    this.auth.exportData().subscribe({
      next: async (blob) => {
        try {
          const file = await this.convert(format, JSON.parse(await blob.text()));
          const url = URL.createObjectURL(file);
          const link = document.createElement('a');
          link.href = url;
          link.download = `iron-pulse-${todayIso()}.${format}`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch {
          this.alerts.error(this.lang.t('profile.export.err'), this.lang.t('toast.retry'));
        } finally {
          this.exporting.set(null);
        }
      },
      error: (err) => {
        this.exporting.set(null);
        this.alerts.error(
          this.lang.t('profile.export.err'),
          this.lang.t(errorHintKey(err)),
        );
      },
    });
  }

  private async convert(format: ExportFormat, data: AccountExport): Promise<Blob> {
    const t = this.lang.t.bind(this.lang);
    return format === 'csv'
      ? exportToCsv(data, t, this.lang.locale)
      : exportToPdf(data, t, this.lang.locale);
  }

  deleteAccount(): void {
    if (this.deleting()) return;
    const ref = this.modal.open(
      ModalBuilder.confirmation()
        .title(this.lang.t('profile.delete.title'))
        .message(this.lang.t('profile.delete.confirm'))
        .tone(ConfirmationTone.DANGER)
        .confirmAction({
          label: this.lang.t('profile.delete.action'),
          style: ActionStyle.DANGER,
        })
        .cancelAction({ label: this.lang.t('action.cancel') })
        .mobileBottomSheet(true)
        .keyboard(KeyboardMode.ENABLED)
        .build(),
    );
    ref.afterClosed$.subscribe(({ result }) => {
      if (!result) return;
      this.deleting.set(true);
      this.auth.deleteAccount().subscribe({
        next: () => this.alerts.success(this.lang.t('profile.delete.done')),
        error: (err) => {
          this.deleting.set(false);
          this.alerts.error(
            this.lang.t('profile.delete.err'),
            this.lang.t(errorHintKey(err)),
          );
        },
      });
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
