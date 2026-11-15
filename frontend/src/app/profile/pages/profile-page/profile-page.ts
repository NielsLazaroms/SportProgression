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
import { AuthService } from '../../../auth/data-access/auth.service';
import { ProgressService } from '../../../progress/data-access/progress.service';
import { compactKg, errorHintKey, formatNumber, todayIso } from '../../../shared/format';
import { AnalysisService, MuscleGroupChoice } from '../../../analysis/analysis.service';
import { ThemeChoice, ThemeService } from '../../../shared/theme.service';

type Locale = 'en' | 'nl';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [AppHeader, RouterLink, AppIcon, MnTranslatePipe],
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

  /** Muscle groups with whether the user trains them; untrained ones are skipped by the analysis. */
  readonly muscleGroups = signal<MuscleGroupChoice[]>([]);
  readonly savingMuscles = signal(false);
  /** Read out by screen readers after a toggle: "Glutes switched off". */
  readonly muscleAnnouncement = signal('');
  /** A toggle made while a save is running: sent right after it. */
  private musclesDirty = false;
  /** Last choice the server confirmed, to fall back on when a save fails. */
  private musclesConfirmed: MuscleGroupChoice[] | null = null;

  readonly exporting = signal(false);
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

  muscleLabel(name: string): string {
    return this.lang.translateIfPresent('muscle.' + name) ?? name;
  }

  /**
   * Switches one group on or off and saves the choice right away. The chips
   * stay enabled meanwhile (a disabled button loses the keyboard focus): a
   * toggle made during a save is shown at once and sent in a follow-up save.
   */
  toggleMuscle(name: string): void {
    const before = this.muscleGroups();
    const group = before.find((g) => g.name === name);
    if (!group) return;
    if (!this.savingMuscles()) this.musclesConfirmed = before;
    this.muscleGroups.set(
      before.map((g) => (g.name === name ? { ...g, trained: !g.trained } : g)),
    );
    this.muscleAnnouncement.set(
      this.lang.t(group.trained ? 'profile.muscles.off' : 'profile.muscles.on', {
        name: this.muscleLabel(name),
      }),
    );
    this.saveMuscles();
  }

  /** One save at a time; the latest choice always wins. */
  private saveMuscles(): void {
    if (this.savingMuscles()) {
      this.musclesDirty = true;
      return;
    }
    this.savingMuscles.set(true);
    this.analysis
      .setIgnoredMuscleGroups(
        this.muscleGroups()
          .filter((g) => !g.trained)
          .map((g) => g.name),
      )
      .subscribe({
        next: (groups) => {
          this.savingMuscles.set(false);
          this.musclesConfirmed = groups;
          if (this.musclesDirty) {
            this.musclesDirty = false;
            this.saveMuscles();
            return;
          }
          this.muscleGroups.set(groups);
        },
        error: (err) => {
          this.savingMuscles.set(false);
          this.musclesDirty = false;
          if (this.musclesConfirmed) this.muscleGroups.set(this.musclesConfirmed);
          this.muscleAnnouncement.set('');
          this.alerts.error(this.lang.t('profile.muscles.err'), this.lang.t(errorHintKey(err)));
        },
      });
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

  /** Download everything stored about me as one JSON file. */
  exportData(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.auth.exportData().subscribe({
      next: (blob) => {
        this.exporting.set(false);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `iron-pulse-${todayIso()}.json`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.exporting.set(false);
        this.alerts.error(
          this.lang.t('profile.export.err'),
          this.lang.t(errorHintKey(err)),
        );
      },
    });
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
