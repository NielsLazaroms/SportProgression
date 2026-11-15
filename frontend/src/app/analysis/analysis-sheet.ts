import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MnLanguageService, MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../shared/app-icon';
import { plural, shortDate } from '../shared/format';
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
        <p class="hyphens-auto font-display text-lg font-bold leading-snug text-on-surface">{{ r.analysis.headline }}</p>
        <p class="mt-2 hyphens-auto leading-relaxed text-on-surface-variant">{{ r.analysis.summary }}</p>

        @for (section of sections(r); track section.key) {
          <section class="mt-4 rounded-xl border border-outline-variant/40 bg-surface-container-low p-4 dark:bg-surface-container-high">
            <h3 class="mb-2 flex items-center gap-2 text-sm font-bold" [class]="section.tone">
              <app-icon [data]="{ name: section.icon, size: 16 }" />
              {{ section.key | mnTranslate }}
            </h3>
            <ul class="space-y-2">
              @for (item of section.items; track $index) {
                <li class="flex gap-2 text-sm leading-relaxed text-on-surface">
                  <span aria-hidden="true" class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-on-surface-variant/60"></span>
                  <span class="min-w-0 hyphens-auto [overflow-wrap:anywhere]">{{ item }}</span>
                </li>
              }
            </ul>
          </section>
        }

        <p class="mt-4 text-xs leading-relaxed text-on-surface-variant">{{ 'analysis.disclaimer' | mnTranslate }}</p>
        <button
          type="button"
          (click)="load(true)"
          class="mt-2 flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary"
        >
          <app-icon [data]="{ name: 'rotate-ccw', size: 16 }" />
          {{ 'analysis.again' | mnTranslate }}
        </button>
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

  /** "9 - 15 Nov · 3 workouts" for a week; nothing for a single workout. */
  readonly subtitle = computed(() => {
    const r = this.loading() ? null : this.result();
    if (!r?.from || !r.to) return '';
    const range = `${shortDate(r.from, this.lang.locale)} - ${shortDate(r.to, this.lang.locale)}`;
    const n = r.workouts ?? 0;
    return `${range} · ${n} ${this.lang.t(plural(n, 'analysis.workouts'))}`;
  });

  ngOnInit(): void {
    this.load(false);
  }

  load(fresh: boolean): void {
    this.loading.set(true);
    this.error.set(null);
    const id = this.workoutId();
    const locale = this.lang.locale;
    (id ? this.service.workout(id, locale, fresh) : this.service.week(locale, fresh))
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
