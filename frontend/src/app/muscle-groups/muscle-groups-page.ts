import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MnAlertService, MnLanguageService, MnSkeleton, MnTranslatePipe } from 'mn-angular-lib';
import { AppHeader } from '../layout/app-header';
import { AppIcon } from '../shared/app-icon';
import { errorHintKey } from '../shared/format';
import { AnalysisService, MuscleGroupChoice } from '../analysis/analysis.service';

/**
 * Which muscle groups the user trains. A group switched off is skipped on
 * purpose: analyses do not report it as missing and plans leave it alone.
 */
@Component({
  selector: 'app-muscle-groups-page',
  standalone: true,
  imports: [AppHeader, AppIcon, MnSkeleton, MnTranslatePipe],
  template: `
    <app-header [title]="'muscles.title' | mnTranslate" (back)="back()" />

    <main class="mx-auto max-w-2xl px-4 pb-28 pt-20">
      @if (!loaded()) {
        <mn-skeleton [data]="{ shape: 'rectangle', height: '160px' }" class="rounded-2xl" />
      } @else {
        <div class="mb-3 flex items-center justify-between gap-2 px-1">
          <p id="muscles-label" class="text-sm text-on-surface-variant">{{ 'profile.muscles.hint' | mnTranslate }}</p>
          @if (skipped().length) {
            <button
              type="button"
              (click)="allOn()"
              class="min-h-9 shrink-0 rounded-lg px-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              {{ 'gym.all' | mnTranslate }}
            </button>
          }
        </div>
        <!-- Never disabled while saving: a disabled button drops the keyboard focus. -->
        <div
          role="group"
          aria-labelledby="muscles-label"
          [attr.aria-busy]="saving()"
          class="grid grid-cols-2 gap-1.5 min-[380px]:grid-cols-3 sm:grid-cols-4"
        >
          @for (g of groups(); track g.name) {
            <button
              type="button"
              (click)="toggle(g.name)"
              [attr.aria-pressed]="g.trained"
              class="flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl px-2 text-sm font-semibold transition-colors"
              [class]="g.trained ? 'bg-primary/15 text-primary' : 'glass-card text-on-surface-variant'"
            >
              @if (g.trained) {
                <app-icon [data]="{ name: 'check', size: 14 }" />
              }
              <span class="min-w-0 truncate">{{ label(g.name) }}</span>
            </button>
          }
        </div>
        <p class="sr-only" role="status" aria-live="polite">{{ announcement() }}</p>
      }
    </main>
  `,
})
export class MuscleGroupsPage implements OnInit {
  private readonly analysis = inject(AnalysisService);
  private readonly lang = inject(MnLanguageService);
  private readonly alerts = inject(MnAlertService);
  private readonly router = inject(Router);

  readonly loaded = signal(false);
  readonly groups = signal<MuscleGroupChoice[]>([]);
  readonly saving = signal(false);
  /** Read out by screen readers after a toggle: "Glutes switched off". */
  readonly announcement = signal('');
  readonly skipped = computed(() => this.groups().filter((g) => !g.trained));

  /** A toggle made while a save is running: sent right after it. */
  private dirty = false;
  /** Last choice the server confirmed, to fall back on when a save fails. */
  private confirmed: MuscleGroupChoice[] | null = null;

  ngOnInit(): void {
    this.analysis.muscleGroups().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.confirmed = groups;
        this.loaded.set(true);
      },
      error: (err) =>
        this.alerts.error(this.lang.t('profile.muscles.err'), this.lang.t(errorHintKey(err))),
    });
  }

  back(): void {
    this.router.navigate(['/profile']);
  }

  label(name: string): string {
    return this.lang.translateIfPresent('muscle.' + name) ?? name;
  }

  toggle(name: string): void {
    const group = this.groups().find((g) => g.name === name);
    if (!group) return;
    this.groups.update((list) => list.map((g) => (g === group ? { ...g, trained: !g.trained } : g)));
    this.announcement.set(
      this.lang.t(group.trained ? 'profile.muscles.off' : 'profile.muscles.on', { name: this.label(name) }),
    );
    this.save();
  }

  allOn(): void {
    this.groups.update((list) => list.map((g) => ({ ...g, trained: true })));
    this.announcement.set(this.lang.t('muscles.allOn'));
    this.save();
  }

  /** One save at a time; the latest choice always wins. */
  private save(): void {
    if (this.saving()) {
      this.dirty = true;
      return;
    }
    this.saving.set(true);
    this.analysis
      .setIgnoredMuscleGroups(this.skipped().map((g) => g.name))
      .subscribe({
        next: (groups) => {
          this.saving.set(false);
          this.confirmed = groups;
          if (this.dirty) {
            this.dirty = false;
            this.save();
            return;
          }
          this.groups.set(groups);
        },
        error: (err) => {
          this.saving.set(false);
          this.dirty = false;
          if (this.confirmed) this.groups.set(this.confirmed);
          this.announcement.set('');
          this.alerts.error(this.lang.t('profile.muscles.err'), this.lang.t(errorHintKey(err)));
        },
      });
  }
}
