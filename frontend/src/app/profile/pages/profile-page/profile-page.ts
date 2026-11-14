import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ActionStyle,
  ConfirmationTone,
  MnAlertService,
  MnLanguageService,
  MnModalService,
  MnTranslatePipe,
  ModalBuilder,
} from 'mn-angular-lib';
import { AppIcon } from '../../../shared/app-icon';
import { AppHeader } from '../../../layout/app-header';
import { AuthService } from '../../../auth/data-access/auth.service';
import { ProgressService } from '../../../progress/data-access/progress.service';
import { compactKg, errorHintKey, formatNumber, todayIso } from '../../../shared/format';
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
    this.progressService.getSummary().subscribe({
      next: (s) => {
        this.workoutCount.set(s.totals?.workouts ?? 0);
        this.lifetimeVolume.set(s.totals?.volumeKg ?? 0);
      },
      // Unknown stays "—": a made-up 0 would be wrong.
      error: () => undefined,
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
