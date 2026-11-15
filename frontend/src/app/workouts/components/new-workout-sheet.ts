import {
  Component,
  ElementRef,
  OnInit,
  afterNextRender,
  computed,
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
import { SupersetRole, supersetLetter, supersetRole } from '../../shared/superset';
import { TemplateService } from '../../templates/data-access/template.service';
import { WorkoutTemplate } from '../../templates/models/template.model';
import { WorkoutService } from '../data-access/workout.service';
import { Workout } from '../models/workout.model';

/** Server limits (see the workout DTOs). */
const NAME_MAX = 100;
const NOTES_MAX = 255;

/**
 * The one "New workout" bottom sheet. Three modes, same form:
 *  - blank (no inputs): an empty workout;
 *  - `source` set: a re-run, the exercises of that workout are copied;
 *  - `template` set: a workout started from a template, its exercises come
 *    with their target sets × reps.
 * Creates the workout and opens it; emits `closed` when the sheet should be
 * removed.
 *
 *   @if (sheetOpen()) {
 *     <app-new-workout-sheet [source]="rerunSource()" [template]="startTemplate()" (closed)="sheetOpen.set(false)" />
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
  private readonly templateService = inject(TemplateService);
  private readonly router = inject(Router);
  private readonly alerts = inject(MnAlertService);
  private readonly lang = inject(MnLanguageService);

  /** Workout to re-run; null for a blank new workout. */
  readonly source = input<Workout | null>(null);
  /** Template to start from; wins over `source` when both are set. */
  readonly template = input<WorkoutTemplate | null>(null);
  readonly closed = output<void>();

  /**
   * The exercises the new workout starts with (from the template, else from
   * the workout being re-run), in order, each with its place in a superset.
   */
  readonly plan = computed<
    { id: string | number; name: string; target: string | null; role: SupersetRole; letter: string | null }[]
  >(() => {
    const tpl = this.template();
    const list = tpl
      ? [...(tpl.exercises ?? [])].sort((a, b) => a.orderInTemplate - b.orderInTemplate)
      : [...(this.source()?.exercises ?? [])].sort((a, b) => a.orderInWorkout - b.orderInWorkout);
    return list.map((ex, i) => ({
      id: ex.id,
      name: ex.name,
      target: ex.targetSets && ex.targetReps ? `${ex.targetSets} × ${ex.targetReps}` : null,
      role: supersetRole(list, i),
      letter: supersetLetter(list, i),
    }));
  });

  private readonly body = viewChild<ElementRef<HTMLElement>>('body');

  readonly name = signal('');
  readonly date = signal(todayIso());
  readonly notes = signal('');
  readonly saving = signal(false);

  readonly notesMax = NOTES_MAX;

  constructor() {
    // The kit's input has no maxlength prop: set it on the real <input>, and
    // put the cursor in the name field so typing can start right away. A
    // prefilled name (re-run, template) is left alone so the keyboard does not
    // cover the plan on a phone.
    afterNextRender(() => {
      const input = this.body()?.nativeElement.querySelector<HTMLInputElement>('#wname');
      if (!input) return;
      input.maxLength = NAME_MAX;
      if (!this.template()) input.focus({ preventScroll: true });
    });
  }

  ngOnInit(): void {
    this.name.set(this.template()?.name ?? this.source()?.name ?? '');
  }

  titleKey(): string {
    if (this.template()) return 'dialog.startTemplate';
    return this.source() ? 'dialog.rerunWorkout' : 'dialog.newWorkout';
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
    const template = this.template();
    const source = this.source();
    const request = template
      ? this.templateService.start(template.id, details)
      : source
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
        const title = template
          ? 'templates.toast.start.err'
          : source
            ? 'toast.rerun.err'
            : 'toast.create.workout.err';
        this.alerts.error(
          this.lang.t(title),
          this.lang.t(
            template && err?.status === 404 ? 'templates.toast.gone' : errorHintKey(err),
          ),
        );
      },
    });
  }
}
