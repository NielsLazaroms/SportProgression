import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MnLanguageService, MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../shared/app-icon';
import { plural, shortDate, todayIso } from '../shared/format';
import { AiError, aiError } from './ai-error';
import { AiSheet } from './ai-sheet';
import { AiErrorBox, AiLoading } from './ai-states';
import { AnalysisResult, AnalysisService } from './analysis.service';

/**
 * Sheet that asks for an analysis and shows it. Without `workoutId` it
 * analyses this week's workouts, with it that one workout. The request starts
 * when the sheet opens, so only render it after the user asked for it:
 *
 *   @if (showAnalysis()) {
 *     <app-analysis-sheet [workoutId]="id" (closed)="showAnalysis.set(false)" />
 *   }
 */
@Component({
  selector: 'app-analysis-sheet',
  standalone: true,
  imports: [AppIcon, AiSheet, AiLoading, AiErrorBox, MnTranslatePipe],
  template: `
    <app-ai-sheet
      [title]="(workoutId() ? 'analysis.title.workout' : 'analysis.title.week') | mnTranslate"
      [subtitle]="subtitle()"
      [announce]="announce()"
      (closed)="closed.emit()"
    >
      @if (loading()) {
        <app-ai-loading message="analysis.loading" [steps]="loadingSteps" />
      } @else if (error(); as e) {
        <app-ai-error [error]="e" (retry)="load(true)" (closed)="closed.emit()" />
      } @else if (result(); as r) {
        <p class="hyphens-auto font-display text-[1.5rem] font-extrabold leading-[1.2] tracking-tight text-on-surface">{{ r.analysis.headline }}</p>
        <p class="mt-2 hyphens-auto leading-relaxed text-on-surface-variant">{{ r.analysis.summary }}</p>

        @for (section of sections(r); track section.key) {
          <section class="mt-6">
            <h3 class="mb-2 flex items-center gap-1.5 px-1 text-sm font-semibold text-on-surface-variant">
              <span [class]="section.tone"><app-icon [data]="{ name: section.icon, size: 16 }" /></span>
              {{ section.key | mnTranslate }}
            </h3>
            <!-- One point, one row: no bullets to scan past -->
            <ul class="space-y-2">
              @for (item of section.items; track $index) {
                <li class="hyphens-auto rounded-2xl bg-surface-container-high px-4 py-3 leading-relaxed text-on-surface [overflow-wrap:anywhere]">{{ item }}</li>
              }
            </ul>
          </section>
        }

        <p class="mt-6 px-1 text-xs leading-relaxed text-on-surface-variant">{{ 'analysis.disclaimer' | mnTranslate }}</p>
        <!-- A workout is analysed once and saved, so only the week can be asked again -->
        @if (!workoutId()) {
          <button
            type="button"
            (click)="load(true)"
            class="mt-1 flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-primary"
          >
            <app-icon [data]="{ name: 'rotate-ccw', size: 16 }" />
            {{ 'analysis.again' | mnTranslate }}
          </button>
        }
      }
    </app-ai-sheet>
  `,
})
export class AnalysisSheet implements OnInit {
  private readonly service = inject(AnalysisService);
  private readonly lang = inject(MnLanguageService);
  private readonly destroyRef = inject(DestroyRef);

  /** Workout to analyse; null analyses this week. */
  readonly workoutId = input<string | null>(null);
  readonly closed = output<void>();

  readonly loading = signal(true);
  readonly result = signal<AnalysisResult | null>(null);
  readonly error = signal<AiError | null>(null);

  readonly loadingSteps = ['analysis.loading.1', 'analysis.loading.2', 'analysis.loading.3'];

  /** What a screen reader hears when the state changes. */
  readonly announce = computed(() => {
    if (this.loading()) return this.lang.t('analysis.loading');
    const e = this.error();
    if (e) return this.lang.t(e.title);
    return this.result() ? this.lang.t('analysis.ready') : '';
  });

  /**
   * "9 - 15 Nov · 3 workouts" for a week (with "· Analysed on 12 Nov" when
   * that was not today); "Analysed on 21 Nov" for a workout.
   */
  readonly subtitle = computed(() => {
    const r = this.loading() ? null : this.result();
    if (!r) return '';
    const day = r.createdAt ? todayIso(new Date(r.createdAt)) : '';
    const savedOn = day
      ? `${this.lang.t('analysis.savedOn')} ${shortDate(day, this.lang.locale, day.slice(0, 4) !== todayIso().slice(0, 4))}`
      : '';
    if (!r.from || !r.to) return savedOn;
    const range = `${shortDate(r.from, this.lang.locale)} - ${shortDate(r.to, this.lang.locale)}`;
    const n = r.workouts ?? 0;
    const week = `${range} · ${n} ${this.lang.t(plural(n, 'analysis.workouts'))}`;
    return savedOn && day !== todayIso() ? `${week} · ${savedOn}` : week;
  });

  ngOnInit(): void {
    this.load(false);
  }

  load(fresh: boolean): void {
    this.loading.set(true);
    this.error.set(null);
    const id = this.workoutId();
    const locale = this.lang.locale;
    (id ? this.service.workout(id, locale) : this.service.week(locale, fresh))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.result.set(r);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.result.set(null);
          this.error.set(
            aiError(err, 'analysis.err.failed', id ? 'analysis.err.nothing.workout' : 'analysis.err.nothing.week'),
          );
        },
      });
  }

  sections(r: AnalysisResult): { key: string; icon: string; tone: string; items: string[] }[] {
    const a = r.analysis;
    return [
      { key: 'analysis.wentWell', icon: 'check', tone: 'text-success', items: a.wentWell },
      // Neutral on purpose: orange is reserved for warm-ups.
      { key: 'analysis.watchOut', icon: 'eye', tone: 'text-on-surface', items: a.watchOut },
      { key: 'analysis.nextTime', icon: 'arrow-up-right', tone: 'text-primary', items: a.nextTime },
    ].filter((s) => s.items?.length);
  }
}
