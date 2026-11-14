import {
  Component,
  ElementRef,
  OnInit,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  MnAlertService,
  MnBottomSheet,
  MnButton,
  MnInputField,
  MnLanguageService,
  MnTranslatePipe,
} from 'mn-angular-lib';
import { AppIcon } from '../../shared/app-icon';
import { errorHintKey, todayIso } from '../../shared/format';
import { WorkoutService } from '../data-access/workout.service';
import { Workout } from '../models/workout.model';

/** Server limits (see the workout DTOs). */
const NAME_MAX = 100;
const NOTES_MAX = 255;

/**
 * The one "New workout" bottom sheet. With `source` set it starts a re-run
 * instead: same form, prefilled name, and the exercises of that workout are
 * copied into the new one. Creates the workout and opens it; emits `closed`
 * when the sheet should be removed.
 *
 *   @if (sheetOpen()) {
 *     <app-new-workout-sheet [source]="rerunSource()" (closed)="sheetOpen.set(false)" />
 *   }
 */
@Component({
  selector: 'app-new-workout-sheet',
  standalone: true,
  imports: [FormsModule, AppIcon, MnBottomSheet, MnButton, MnInputField, MnTranslatePipe],
  templateUrl: './new-workout-sheet.html',
  host: { '(document:keydown.escape)': 'close()' },
})
export class NewWorkoutSheet implements OnInit {
  private readonly workoutService = inject(WorkoutService);
  private readonly router = inject(Router);
  private readonly alerts = inject(MnAlertService);
  private readonly lang = inject(MnLanguageService);

  /** Workout to re-run; null for a blank new workout. */
  readonly source = input<Workout | null>(null);
  readonly closed = output<void>();

  private readonly body = viewChild<ElementRef<HTMLElement>>('body');

  readonly name = signal('');
  readonly date = signal(todayIso());
  readonly notes = signal('');
  readonly saving = signal(false);

  readonly notesMax = NOTES_MAX;

  constructor() {
    // The kit's input has no maxlength prop: set it on the real <input>, and
    // put the cursor in the name field so typing can start right away.
    afterNextRender(() => {
      const input = this.body()?.nativeElement.querySelector<HTMLInputElement>('#wname');
      if (!input) return;
      input.maxLength = NAME_MAX;
      input.focus({ preventScroll: true });
    });
  }

  ngOnInit(): void {
    this.name.set(this.source()?.name ?? '');
  }

  canCreate(): boolean {
    return !!this.name().trim() && !!this.date() && !this.saving();
  }

  close(): void {
    if (this.saving()) return;
    this.closed.emit();
  }

  create(): void {
    if (!this.canCreate()) return;
    this.saving.set(true);
    const details = {
      name: this.name().trim().slice(0, NAME_MAX),
      date: this.date(),
      description: this.notes().trim().slice(0, NOTES_MAX) || undefined,
    };
    const source = this.source();
    const request = source
      ? this.workoutService.duplicateWorkout(source.id, details)
      : this.workoutService.createWorkout(details);
    request.subscribe({
      next: (created) => {
        this.saving.set(false);
        this.closed.emit();
        this.router.navigate(['/workouts', created.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.alerts.error(
          this.lang.t(source ? 'toast.rerun.err' : 'toast.create.workout.err'),
          this.lang.t(errorHintKey(err)),
        );
      },
    });
  }
}
