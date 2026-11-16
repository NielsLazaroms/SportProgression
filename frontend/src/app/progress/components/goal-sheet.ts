import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { AppIcon } from '../../shared/app-icon';
import { errorHintKey } from '../../shared/format';
import { MUSCLE_GROUPS } from '../../shared/muscle-groups';
import { BodyweightTag } from '../../shared/bodyweight';
import { TargetStepper } from '../../templates/components/target-stepper';
import { DecimalInput } from '../../workouts/components/decimal-input';
import { ExercisePicker } from '../../workouts/components/exercise-picker/exercise-picker';
import { ExerciseDefinitionService } from '../../exercises/data-access/exercise-definition.service';
import {
  ExerciseDefinition,
  ExerciseType,
  isBodyweight,
} from '../../exercises/models/exercise.model';
import { GoalService } from '../data-access/goal.service';
import { GOAL_NOTE_MAX, Goal, GoalKind, SaveGoal } from '../models/goal.model';

/** The exercise a lift goal is about (from the catalog or from the goal itself). */
interface ChosenExercise {
  id: number;
  name: string;
  bodyweight: boolean;
}

/** A starting point that matches what most people train for. */
const DEFAULT_REPS = 5;
const DEFAULT_SETS_PER_WEEK = 12;

/**
 * Add, change or delete a goal. A lift goal is one set to reach on one
 * exercise; a muscle group goal is a number of working sets every week.
 */
@Component({
  selector: 'app-goal-sheet',
  standalone: true,
  imports: [
    FormsModule,
    MnBottomSheet,
    MnButton,
    MnInputField,
    MnTranslatePipe,
    AppIcon,
    BodyweightTag,
    TargetStepper,
    DecimalInput,
    ExercisePicker,
  ],
  templateUrl: './goal-sheet.html',
})
export class GoalSheet implements OnInit {
  private readonly goals = inject(GoalService);
  private readonly definitionsApi = inject(ExerciseDefinitionService);
  private readonly alerts = inject(MnAlertService);
  private readonly modal = inject(MnModalService);
  private readonly lang = inject(MnLanguageService);

  /** The goal to change; null adds a new one. */
  readonly goal = input<Goal | null>(null);
  /** A new goal starts as a lift goal for this exercise. */
  readonly presetExercise = input<ChosenExercise | null>(null);

  /** The whole list after a save or delete. */
  readonly saved = output<Goal[]>();
  readonly closed = output<void>();

  readonly kind = signal<GoalKind>('lift');
  readonly exercise = signal<ChosenExercise | null>(null);
  readonly choosing = signal(false);
  readonly weightKg = signal<number | null>(null);
  readonly reps = signal(DEFAULT_REPS);
  readonly muscle = signal<string>('');
  readonly setsPerWeek = signal(DEFAULT_SETS_PER_WEEK);
  readonly targetDate = signal('');
  readonly note = signal('');
  readonly saving = signal(false);
  readonly creatingExercise = signal(false);

  readonly definitions = signal<ExerciseDefinition[]>([]);
  readonly muscles = MUSCLE_GROUPS;
  readonly noteMax = GOAL_NOTE_MAX;

  readonly isEdit = computed(() => !!this.goal());

  /** Why Save is not possible yet (an i18n key), or null. */
  readonly block = computed<string | null>(() => {
    if (this.kind() === 'lift') {
      if (!this.exercise()) return 'goals.form.needExercise';
      const w = this.weightKg();
      if (!this.exercise()!.bodyweight && !(w != null && w > 0)) return 'goals.form.needWeight';
      if (w != null && (w < 0 || w > 2000)) return 'goals.form.needWeight';
      return null;
    }
    return this.muscle() ? null : 'goals.form.needMuscle';
  });

  ngOnInit(): void {
    const g = this.goal();
    if (g) {
      this.kind.set(g.kind);
      this.targetDate.set(g.targetDate ?? '');
      this.note.set(g.note ?? '');
      if (g.kind === 'lift') {
        this.exercise.set({ id: g.exerciseDefinitionId, name: g.exerciseName, bodyweight: g.bodyweight });
        this.weightKg.set(g.targetWeightKg);
        this.reps.set(g.targetReps);
      } else {
        this.muscle.set(g.muscleGroup);
        this.setsPerWeek.set(g.targetSetsPerWeek);
      }
    } else if (this.presetExercise()) {
      this.exercise.set(this.presetExercise());
    }
    this.definitionsApi.getAll().subscribe({
      next: (defs) => this.definitions.set(defs.filter((d) => d.type === ExerciseType.STRENGTH || isBodyweight(d))),
      error: () => this.definitions.set([]),
    });
  }

  setKind(kind: GoalKind): void {
    this.kind.set(kind);
  }

  startChoosing(): void {
    this.choosing.set(true);
  }

  pick(def: ExerciseDefinition): void {
    this.exercise.set({ id: def.id, name: def.name, bodyweight: isBodyweight(def) });
    this.choosing.set(false);
  }

  /** An exercise that is not in the catalog yet: add it, then choose it. */
  createExercise(dto: { name: string; muscleGroup: string; type: ExerciseType }): void {
    this.creatingExercise.set(true);
    this.definitionsApi.create(dto).subscribe({
      next: (def) => {
        this.definitions.update((list) => [...list, def]);
        this.creatingExercise.set(false);
        this.pick(def);
      },
      error: (err) => {
        this.creatingExercise.set(false);
        this.alerts.error(this.lang.t('goals.toast.exercise.err'), this.lang.t(errorHintKey(err)));
      },
    });
  }

  muscleLabel(value: string): string {
    return this.lang.translateIfPresent('muscle.' + value) ?? value;
  }

  save(): void {
    if (this.block() || this.saving()) return;
    const shared = { targetDate: this.targetDate() || null, note: this.note().trim() || null };
    const dto: SaveGoal =
      this.kind() === 'lift'
        ? {
            kind: 'lift',
            exerciseDefinitionId: this.exercise()!.id,
            targetWeightKg: this.weightKg() ?? 0,
            targetReps: this.reps(),
            ...shared,
          }
        : { kind: 'muscle', muscleGroup: this.muscle(), targetSetsPerWeek: this.setsPerWeek(), ...shared };
    const g = this.goal();
    this.saving.set(true);
    (g ? this.goals.update(g.id, dto) : this.goals.create(dto)).subscribe({
      next: (list) => {
        this.saving.set(false);
        this.alerts.success(this.lang.t(g ? 'goals.toast.saved' : 'goals.toast.added'));
        this.saved.emit(list);
      },
      error: (err) => {
        this.saving.set(false);
        const tooMany = (err as { error?: { code?: string } })?.error?.code === 'too_many_goals';
        this.alerts.error(
          this.lang.t('goals.toast.save.err'),
          tooMany ? this.lang.t('goals.toast.tooMany') : this.lang.t(errorHintKey(err)),
        );
      },
    });
  }

  remove(): void {
    const g = this.goal();
    if (!g) return;
    const ref = this.modal.open(
      ModalBuilder.confirmation()
        .title(this.lang.t('goals.delete.title'))
        .message(this.lang.t('goals.delete.confirm'))
        .tone(ConfirmationTone.DANGER)
        .confirmAction({ label: this.lang.t('action.delete'), style: ActionStyle.DANGER })
        .cancelAction({ label: this.lang.t('action.cancel') })
        .mobileBottomSheet(true)
        .keyboard(KeyboardMode.ENABLED)
        .build(),
    );
    ref.afterClosed$.subscribe(({ result }) => {
      if (!result) return;
      this.goals.delete(g.id).subscribe({
        next: () => {
          this.alerts.success(this.lang.t('goals.toast.deleted'));
          this.goals.getAll().subscribe({
            next: (list) => this.saved.emit(list),
            error: () => this.closed.emit(),
          });
        },
        error: (err) =>
          this.alerts.error(this.lang.t('goals.toast.delete.err'), this.lang.t(errorHintKey(err))),
      });
    });
  }
}
