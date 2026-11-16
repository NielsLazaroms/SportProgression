import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  ActionStyle,
  ConfirmationTone,
  KeyboardMode,
  MnAlertService,
  MnBottomSheet,
  MnButton,
  MnInputField,
  MnLanguageService,
  MnModalService,
  MnTranslatePipe,
  ModalBuilder,
} from 'mn-angular-lib';
import { AppIcon } from '../shared/app-icon';
import { errorHintKey, todayIso } from '../shared/format';
import { supersetLetter } from '../shared/superset';
import { ScheduleService } from './schedule.service';
import { ScheduleStatus, ScheduledWorkout } from './schedule.model';
import { scheduleDay, scheduleTarget, statusKey } from './schedule-format';

/** One planned workout: what it holds, and start, move or remove it. */
@Component({
  selector: 'app-scheduled-sheet',
  standalone: true,
  imports: [FormsModule, RouterLink, MnBottomSheet, MnButton, MnInputField, MnTranslatePipe, AppIcon],
  template: `
    @let it = item();
    <mn-bottom-sheet [maxHeightVh]="90" [ariaLabel]="it.name" (dismiss)="closed.emit()">
      <div class="mx-auto max-h-[80dvh] w-full max-w-xl overflow-y-auto overscroll-contain px-5 pt-2">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold" [class]="status() === 'missed' ? 'text-on-surface-variant' : 'text-primary'">
              {{ day() }} · {{ statusLabel() | mnTranslate }}
            </p>
            <h2 class="font-display text-xl font-bold text-on-surface [overflow-wrap:anywhere]">{{ it.name }}</h2>
          </div>
          <button
            type="button"
            (click)="closed.emit()"
            [attr.aria-label]="'action.close' | mnTranslate"
            class="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-variant/50"
          >
            <app-icon [data]="{ name: 'x', size: 22 }" />
          </button>
        </div>

        @if (it.note) {
          <p class="mb-4 text-sm leading-relaxed text-on-surface-variant">{{ it.note }}</p>
        }

        <ul class="mb-5 divide-y divide-outline-variant/20 rounded-2xl bg-surface-container-high px-4">
          @for (ex of it.exercises; track $index) {
            @let letter = supersetLetter(it.exercises, $index);
            <li class="flex items-baseline justify-between gap-3 py-2.5 text-sm">
              <span class="min-w-0 font-semibold text-on-surface [overflow-wrap:anywhere]">
                @if (letter) {
                  <span class="tnum mr-1 inline-flex h-4 min-w-4 items-center justify-center rounded border border-primary px-0.5 align-middle text-[11px] font-bold leading-none text-primary">{{ letter }}</span>
                }
                {{ ex.name }}
              </span>
              <span class="tnum shrink-0 text-on-surface-variant">{{ target(ex) }}</span>
            </li>
          }
        </ul>

        @if (it.workoutId) {
          <a
            [routerLink]="['/workouts', it.workoutId]"
            (click)="closed.emit()"
            class="mb-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-lg font-bold text-on-primary-container"
          >
            <app-icon [data]="{ name: 'play', size: 18 }" />
            {{ 'schedule.open' | mnTranslate }}
          </a>
        } @else {
          <button
            type="button"
            (click)="start()"
            [attr.aria-disabled]="busy() ? 'true' : null"
            class="flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-lg font-bold text-on-primary-container transition-transform active:scale-[0.98]"
            [class.opacity-70]="busy()"
          >
            <app-icon [data]="{ name: 'play', size: 18 }" />
            {{ (busy() === 'start' ? 'action.creating' : 'schedule.start') | mnTranslate }}
          </button>
          @if (it.date !== today) {
            <p class="mt-1.5 px-1 text-xs text-on-surface-variant">{{ 'schedule.start.hint' | mnTranslate }}</p>
          }

          <!-- Move -->
          <div class="mt-5">
            <p class="mb-1 text-sm font-semibold text-on-surface-variant">{{ 'schedule.move' | mnTranslate }}</p>
            <div class="flex items-end gap-2">
              <mn-lib-input-field
                class="min-w-0 flex-1"
                [props]="{ id: 'schedule-date', type: 'date', label: ('schedule.move.date' | mnTranslate), fullWidth: true }"
                [ngModel]="moveDate()"
                (ngModelChange)="moveDate.set($event ?? '')"
                [ngModelOptions]="{ standalone: true }"
              />
              <button
                mnButton
                type="button"
                [data]="{ color: 'secondary', size: 'lg', disabled: !canMove() || !!busy() }"
                (click)="move(moveDate())"
              >
                {{ (busy() === 'move' ? 'action.saving' : 'schedule.move.go') | mnTranslate }}
              </button>
            </div>
            @if (status() === 'missed') {
              <button type="button" (click)="move(today)" class="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary">
                <app-icon [data]="{ name: 'calendar', size: 16 }" />
                {{ 'schedule.move.today' | mnTranslate }}
              </button>
            }
          </div>
        }

        <div class="pb-5 pt-4">
          <button
            type="button"
            (click)="remove()"
            class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-error"
          >
            <app-icon [data]="{ name: 'trash-2', size: 16 }" />
            {{ 'schedule.remove' | mnTranslate }}
          </button>
        </div>
      </div>
    </mn-bottom-sheet>
  `,
})
export class ScheduledSheet implements OnInit {
  private readonly schedule = inject(ScheduleService);
  private readonly router = inject(Router);
  private readonly alerts = inject(MnAlertService);
  private readonly modal = inject(MnModalService);
  private readonly lang = inject(MnLanguageService);

  readonly item = input.required<ScheduledWorkout>();
  readonly status = input.required<ScheduleStatus>();
  readonly closed = output<void>();

  readonly today = todayIso();
  readonly busy = signal<'start' | 'move' | null>(null);
  readonly moveDate = signal('');
  readonly canMove = computed(() => !!this.moveDate() && this.moveDate() !== this.item().date);
  readonly supersetLetter = supersetLetter;

  ngOnInit(): void {
    this.moveDate.set(this.item().date);
  }

  // Plain methods: they must follow a language switch.
  day(): string {
    return scheduleDay(this.item().date, this.today, this.lang);
  }

  statusLabel(): string {
    return statusKey(this.status());
  }

  target = (ex: ScheduledWorkout['exercises'][number]) => scheduleTarget(ex, this.lang);

  start(): void {
    if (this.busy()) return;
    this.busy.set('start');
    this.schedule.start(this.item().id).subscribe({
      next: (workout) => {
        void this.router.navigate(['/workouts', workout.id]).then((moved) => {
          this.busy.set(null);
          if (!moved) this.closed.emit();
        });
      },
      error: (err) => {
        this.busy.set(null);
        const empty = (err as { error?: { code?: string } })?.error?.code === 'no_exercises';
        this.alerts.error(
          this.lang.t('schedule.toast.start.err'),
          empty ? this.lang.t('schedule.toast.noExercises') : this.lang.t(errorHintKey(err)),
        );
      },
    });
  }

  move(date: string): void {
    if (this.busy() || !date || date === this.item().date) return;
    this.busy.set('move');
    this.schedule.move(this.item().id, date).subscribe({
      next: () => {
        this.busy.set(null);
        this.alerts.success(this.lang.t('schedule.toast.moved', { day: scheduleDay(date, this.today, this.lang) }));
        this.closed.emit();
      },
      error: (err) => {
        this.busy.set(null);
        this.alerts.error(this.lang.t('schedule.toast.move.err'), this.lang.t(errorHintKey(err)));
      },
    });
  }

  remove(): void {
    const it = this.item();
    const ref = this.modal.open(
      ModalBuilder.confirmation()
        .title(this.lang.t('schedule.remove.title'))
        .message(this.lang.t('schedule.remove.confirm', { name: it.name, day: this.day() }))
        .tone(ConfirmationTone.DANGER)
        .confirmAction({ label: this.lang.t('schedule.remove.go'), style: ActionStyle.DANGER })
        .cancelAction({ label: this.lang.t('action.cancel') })
        .mobileBottomSheet(true)
        .keyboard(KeyboardMode.ENABLED)
        .build(),
    );
    ref.afterClosed$.subscribe(({ result }) => {
      if (!result) return;
      this.schedule.remove(it.id).subscribe({
        next: () => {
          this.alerts.success(this.lang.t('schedule.toast.removed'));
          this.closed.emit();
        },
        error: (err) =>
          this.alerts.error(this.lang.t('schedule.toast.remove.err'), this.lang.t(errorHintKey(err))),
      });
    });
  }
}
