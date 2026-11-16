import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { concatMap, from, of, toArray } from 'rxjs';
import {
  MnAlertService,
  MnBottomSheet,
  MnButton,
  MnLanguageService,
  MnTranslatePipe,
} from 'mn-angular-lib';
import { AppIcon } from '../../shared/app-icon';
import { errorHintKey, todayIso } from '../../shared/format';
import { ExerciseDefinitionService } from '../../exercises/data-access/exercise-definition.service';
import { AnalysisService } from '../../analysis/analysis.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { ScheduleItem } from '../../schedule/schedule.model';
import { TemplateService } from '../data-access/template.service';
import { SaveTemplate, WorkoutTemplate } from '../models/template.model';
import { STARTER_PROGRAMS, StarterProgram, planFirstWeek } from '../data-access/starter-programs';

/**
 * Pick a ready-made program: its workouts become the user's own templates,
 * and (on by default) the coming week is planned with them.
 */
@Component({
  selector: 'app-starter-programs-sheet',
  standalone: true,
  imports: [MnBottomSheet, MnButton, MnTranslatePipe, AppIcon],
  template: `
    <mn-bottom-sheet [maxHeightVh]="90" [ariaLabel]="'programs.title' | mnTranslate" (dismiss)="closed.emit()">
      <div class="mx-auto max-h-[80dvh] w-full max-w-xl overflow-y-auto overscroll-contain px-5 pt-2">
        <div class="flex items-center justify-between gap-3">
          <h2 class="min-w-0 font-display text-xl font-bold text-on-surface">{{ 'programs.title' | mnTranslate }}</h2>
          <button
            type="button"
            (click)="closed.emit()"
            [attr.aria-label]="'action.close' | mnTranslate"
            class="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-variant/50"
          >
            <app-icon [data]="{ name: 'x', size: 22 }" />
          </button>
        </div>
        <p id="programs-label" class="mb-4 text-sm text-on-surface-variant">{{ 'programs.intro' | mnTranslate }}</p>

        <ul role="radiogroup" aria-labelledby="programs-label" class="space-y-2">
          @for (p of programs; track p.id) {
            @let on = chosen().id === p.id;
            <li>
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="on"
                (click)="chosen.set(p)"
                class="w-full rounded-2xl border px-4 py-3 text-left transition-colors"
                [class]="on ? 'border-2 border-primary bg-primary/10' : 'border-outline-variant/40'"
              >
                <span class="flex items-center justify-between gap-2">
                  <span class="font-bold text-on-surface">{{ p.title | mnTranslate }}</span>
                  <span
                    class="shrink-0 rounded-lg px-2 py-0.5 text-xs font-semibold"
                    [class]="on ? 'bg-primary/15 text-primary' : 'bg-surface-container-high text-on-surface-variant'"
                  >{{ p.badge | mnTranslate }}</span>
                </span>
                <span class="mt-0.5 block text-sm text-on-surface-variant">{{ p.hint | mnTranslate }}</span>
                @if (on) {
                  <span class="mt-2 block space-y-1">
                    @for (w of p.workouts; track w.name) {
                      <span class="block text-xs text-on-surface-variant">
                        <span class="font-semibold text-on-surface">{{ w.name | mnTranslate }}:</span>
                        {{ exerciseList(w.exercises) }}
                      </span>
                    }
                  </span>
                }
              </button>
            </li>
          }
        </ul>

        <label class="mt-4 flex min-h-11 cursor-pointer items-center gap-3 px-1">
          <input
            type="checkbox"
            class="h-5 w-5 shrink-0 accent-[var(--color-primary)]"
            [checked]="planWeek()"
            (change)="planWeek.set($any($event.target).checked)"
          />
          <span class="text-sm text-on-surface">{{ 'programs.planWeek' | mnTranslate }}</span>
        </label>
        @if (planWeek()) {
          <p class="px-1 text-xs text-on-surface-variant">{{ weekLine() }}</p>
        }

        <div class="flex gap-3 pb-5 pt-5">
          <button mnButton type="button" [data]="{ color: 'gray', size: 'lg', wrap: true }" class="min-w-0 flex-1" (click)="closed.emit()">
            {{ 'action.cancel' | mnTranslate }}
          </button>
          <button
            mnButton
            type="button"
            [data]="{ color: 'primary', size: 'lg', wrap: true, disabled: !ready() || saving() }"
            class="min-w-0 flex-1"
            (click)="add()"
          >
            {{ saving() ? ('action.saving' | mnTranslate) : ('programs.add' | mnTranslate) }}
          </button>
        </div>
      </div>
    </mn-bottom-sheet>
  `,
})
export class StarterProgramsSheet implements OnInit {
  private readonly definitions = inject(ExerciseDefinitionService);
  private readonly templates = inject(TemplateService);
  private readonly schedule = inject(ScheduleService);
  private readonly analysis = inject(AnalysisService);
  private readonly lang = inject(MnLanguageService);
  private readonly alerts = inject(MnAlertService);

  /** The templates that were made, after the sheet has done its work. */
  readonly added = output<WorkoutTemplate[]>();
  readonly closed = output<void>();

  readonly programs = STARTER_PROGRAMS;
  readonly chosen = signal<StarterProgram>(STARTER_PROGRAMS[0]);
  readonly planWeek = signal(true);
  readonly saving = signal(false);
  /** Catalog ids by lower-case name; empty until loaded. */
  private readonly ids = signal<Map<string, number>>(new Map());
  readonly ready = computed(() => this.ids().size > 0);
  private readonly preferredDays = signal<number[]>([]);

  ngOnInit(): void {
    this.definitions.getAll().subscribe({
      next: (list) => this.ids.set(new Map(list.map((d) => [d.name.toLowerCase(), d.id]))),
      error: (err) => this.alerts.error(this.lang.t('programs.err'), this.lang.t(errorHintKey(err))),
    });
    // The user's own training days, when they set them; otherwise the program's.
    this.analysis.coachPreferences().subscribe({
      next: (p) => this.preferredDays.set(p.trainingDays),
      error: () => undefined,
    });
  }

  /** "Squat, Bench Press, Barbell Row, ...": the exercises of one workout. */
  exerciseList(exercises: { name: string }[]): string {
    return exercises.map((e) => e.name).join(', ');
  }

  /** "Planned on Mon, Wed and Fri, starting today." */
  weekLine(): string {
    const plan = planFirstWeek(this.chosen(), todayIso(), this.preferredDays());
    const names = plan.map((p) => this.lang.t('profile.day.short.' + this.weekdayOf(p.date)));
    return this.lang.t('programs.planWeek.days', { days: names.join(', ') });
  }

  add(): void {
    if (!this.ready() || this.saving()) return;
    const program = this.chosen();
    const ids = this.ids();
    const payloads: SaveTemplate[] = program.workouts.map((w) => ({
      name: this.lang.t(w.name),
      exercises: w.exercises.flatMap((e) => {
        const id = ids.get(e.name.toLowerCase());
        return id == null ? [] : [{ exerciseDefinitionId: id, targetSets: e.sets, targetReps: e.reps }];
      }),
    }));
    this.saving.set(true);
    // One at a time, so the templates keep the program's order.
    from(payloads)
      .pipe(
        concatMap((t) => this.templates.create(t)),
        toArray(),
        concatMap((made) => {
          if (!this.planWeek()) return of(made);
          const items: ScheduleItem[] = planFirstWeek(program, todayIso(), this.preferredDays()).map((p) => ({
            date: p.date,
            name: payloads[p.workout].name,
            exercises: payloads[p.workout].exercises.map(({ exerciseDefinitionId, targetSets, targetReps }) => ({
              exerciseDefinitionId,
              targetSets,
              targetReps,
            })),
          }));
          return this.schedule.create(items).pipe(concatMap(() => of(made)));
        }),
      )
      .subscribe({
        next: (made) => {
          this.saving.set(false);
          this.alerts.success(this.lang.t('programs.added', { name: this.lang.t(program.title) }));
          this.added.emit(made);
        },
        error: (err) => {
          this.saving.set(false);
          this.alerts.error(this.lang.t('programs.err'), this.lang.t(errorHintKey(err)));
        },
      });
  }

  private weekdayOf(iso: string): number {
    const [y, m, d] = iso.split('-').map(Number);
    return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
  }
}
