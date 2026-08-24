import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  MnButton,
  MnInputField,
  MnSelect,
  MnSkeleton,
  MnAlertService,
  MnLanguageService,
  MnModalService,
  MnTranslatePipe,
  ModalBuilder,
  ConfirmationTone,
  ActionStyle,
} from 'mn-angular-lib';
import { AppIcon } from '../../../shared/app-icon';
import { AppHeader } from '../../../layout/app-header';
import { WorkoutService } from '../../data-access/workout.service';
import { ExerciseService } from '../../../exercises/data-access/exercise.service';
import { ExerciseDefinitionService } from '../../../exercises/data-access/exercise-definition.service';
import { SetService } from '../../../exercises/data-access/set.service';
import {
  Workout,
  workoutVolumeKg,
  workoutSetCount,
} from '../../models/workout.model';
import {
  ExerciseDefinition,
  ExerciseType,
  WorkoutExercise,
} from '../../../exercises/models/exercise.model';
import { compactKg, relativeDay } from '../../../shared/format';
import { MUSCLE_GROUPS } from '../../../shared/muscle-groups';

interface SetDraft {
  reps: number;
  weight: number;
}

type ExState = 'finished' | 'active' | 'pending';

@Component({
  selector: 'app-workout-detail-page',
  standalone: true,
  imports: [
    AppHeader,
    RouterLink,
    FormsModule,
    AppIcon,
    MnButton,
    MnInputField,
    MnSelect,
    MnSkeleton,
    MnTranslatePipe,
  ],
  templateUrl: './workout-detail-page.html',
})
export class WorkoutDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly workoutService = inject(WorkoutService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly definitionService = inject(ExerciseDefinitionService);
  private readonly setService = inject(SetService);
  private readonly alerts = inject(MnAlertService);
  private readonly lang = inject(MnLanguageService);
  private readonly modal = inject(MnModalService);

  private workoutId = '';

  readonly workout = signal<Workout | null>(null);
  readonly loading = signal(true);
  readonly definitions = signal<ExerciseDefinition[]>([]);

  // Focused-accordion state (editable mode)
  readonly activeId = signal<number | null>(null);
  readonly finishedIds = signal<Set<number>>(new Set());
  // Expanded rows in the read-only (completed) accordion
  readonly expandedIds = signal<Set<number>>(new Set());

  readonly exercises = computed(() => this.workout()?.exercises ?? []);
  readonly completed = computed(() => !!this.workout()?.completedAt);

  /** A workout can be finished only when every exercise has at least one set. */
  readonly canFinish = computed(() => {
    const ex = this.exercises();
    return ex.length > 0 && ex.every((e) => (e.sets?.length ?? 0) > 0);
  });

  /** Why "Finish workout" is blocked, or null when it's allowed. */
  readonly finishBlock = computed<{ key: string; name?: string } | null>(() => {
    const ex = this.exercises();
    if (ex.length === 0) return { key: 'detail.finish.needExercise' };
    const empty = ex.find((e) => (e.sets?.length ?? 0) === 0);
    if (empty) return { key: 'detail.finish.needSet', name: empty.name };
    return null;
  });

  readonly volume = computed(() => {
    const w = this.workout();
    return w ? workoutVolumeKg(w) : 0;
  });
  readonly totalSets = computed(() => {
    const w = this.workout();
    return w ? workoutSetCount(w) : 0;
  });
  readonly finishedCount = computed(() => {
    const ids = this.finishedIds();
    return this.exercises().filter((e) => ids.has(e.id)).length;
  });

  /** A new exercise can only be added once every current one is finished. */
  readonly canAddExercise = computed(() => {
    const ids = this.finishedIds();
    return this.exercises().every((e) => ids.has(e.id));
  });

  readonly definitionOptions = computed(() =>
    this.definitions().map((d) => ({
      label: d.muscleGroup ? `${d.name} · ${d.muscleGroup}` : d.name,
      value: d.id,
    })),
  );

  readonly showAddExercise = signal(false);
  selectedDefinitionId: number | null = null;

  // Inline "create a new exercise not in the list" form
  readonly creatingNew = signal(false);
  readonly savingNew = signal(false);
  newDefName = '';
  newDefMuscle = '';

  /** Muscle options with translated labels (value stays the canonical key). */
  get muscleOptions() {
    return MUSCLE_GROUPS.map((m) => ({ label: this.muscleLabel(m), value: m }));
  }

  /** Translated muscle-group label, falling back to the raw stored value. */
  muscleLabel(value: string | null | undefined): string {
    if (!value) return '';
    return this.lang.translateIfPresent('muscle.' + value) ?? value;
  }

  private readonly drafts = new Map<number, SetDraft>();
  private readonly noteDrafts = new Map<number, string>();

  readonly compactKg = compactKg;
  readonly rel = (d: string) =>
    relativeDay(d, (k, p) => this.lang.t(k, p), this.lang.locale);
  t = (k: string, p?: Record<string, string | number>) => this.lang.t(k, p);

  ngOnInit(): void {
    this.workoutId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadWorkout(true);
    this.loadDefinitions();
  }

  private loadWorkout(initFocus = false): void {
    this.workoutService.getWorkout(this.workoutId).subscribe({
      next: (w) => {
        this.workout.set(w);
        for (const ex of w.exercises ?? []) {
          if (!this.drafts.has(ex.id)) this.drafts.set(ex.id, { reps: 10, weight: 20 });
          if (!this.noteDrafts.has(ex.id)) this.noteDrafts.set(ex.id, ex.notes ?? '');
        }
        if (initFocus) {
          if (w.completedAt) {
            // Completed: read-only accordion, first exercise expanded.
            this.expandedIds.set(
              w.exercises?.length ? new Set([w.exercises[0].id]) : new Set(),
            );
          } else {
            // Already-logged exercises count as done, so re-opening a workout
            // doesn't force you to re-finish them; focus the first unlogged one.
            const done = new Set<number>();
            let firstUnlogged: number | null = null;
            for (const ex of w.exercises ?? []) {
              if ((ex.sets?.length ?? 0) > 0) done.add(ex.id);
              else if (firstUnlogged === null) firstUnlogged = ex.id;
            }
            this.finishedIds.set(done);
            this.activeId.set(firstUnlogged);
          }
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.alerts.error(this.t('toast.load.err.title'), this.t('toast.retry'));
        this.router.navigate(['/workouts']);
      },
    });
  }

  private loadDefinitions(): void {
    this.definitionService.getAll().subscribe({
      next: (d) => {
        this.definitions.set(d);
        if (d.length && this.selectedDefinitionId == null) {
          this.selectedDefinitionId = d[0].id;
        }
      },
      error: () => {},
    });
  }

  state(ex: WorkoutExercise): ExState {
    if (this.finishedIds().has(ex.id)) return 'finished';
    return this.activeId() === ex.id ? 'active' : 'pending';
  }

  setActive(ex: WorkoutExercise): void {
    this.activeId.set(ex.id);
  }

  draft(exerciseId: number): SetDraft {
    let d = this.drafts.get(exerciseId);
    if (!d) {
      d = { reps: 10, weight: 20 };
      this.drafts.set(exerciseId, d);
    }
    return d;
  }

  note(exerciseId: number): string {
    return this.noteDrafts.get(exerciseId) ?? '';
  }

  setNote(exerciseId: number, value: string): void {
    this.noteDrafts.set(exerciseId, value);
  }

  exerciseVolume(ex: WorkoutExercise): number {
    return (ex.sets ?? []).reduce((s, set) => s + set.repsAmount * set.weightKg, 0);
  }

  step(ex: number, field: 'reps' | 'weight', delta: number): void {
    const d = this.draft(ex);
    d[field] = Math.max(0, +(d[field] + delta).toFixed(1));
  }

  saveNotes(ex: WorkoutExercise): void {
    const draft = this.note(ex.id).trim();
    if (draft === (ex.notes ?? '')) return;
    this.exerciseService
      .updateExercise(this.workoutId, ex.id, { notes: draft || undefined })
      .subscribe({
        next: () => {
          ex.notes = draft; // keep local model in sync without a full reload
        },
        error: () => this.alerts.error(this.t('toast.notes.err'), this.t('toast.retry')),
      });
  }

  addExercise(): void {
    if (this.selectedDefinitionId == null) return;
    this.exerciseService
      .createExercise(this.workoutId, {
        exerciseDefinitionId: Number(this.selectedDefinitionId),
        orderInWorkout: this.exercises().length + 1,
      })
      .subscribe({
        next: (created) => {
          this.closeAddExercise();
          this.activeId.set(created.id);
          this.loadWorkout();
        },
        error: () =>
          this.alerts.error(this.t('toast.addExercise.err'), this.t('toast.retry')),
      });
  }

  /** Create a brand-new exercise (adds it to the shared catalog) and log it. */
  addNewExercise(): void {
    const name = this.newDefName.trim();
    const muscle = this.newDefMuscle.trim();
    if (!name || !muscle || this.savingNew()) return;
    this.savingNew.set(true);
    this.definitionService
      .create({
        name,
        type: ExerciseType.STRENGTH,
        muscleGroup: muscle,
      })
      .subscribe({
        next: (def) => {
          this.definitions.update((list) => [...list, def]);
          this.exerciseService
            .createExercise(this.workoutId, {
              exerciseDefinitionId: def.id,
              orderInWorkout: this.exercises().length + 1,
            })
            .subscribe({
              next: (created) => {
                this.savingNew.set(false);
                this.closeAddExercise();
                this.activeId.set(created.id);
                this.loadWorkout();
              },
              error: () => {
                this.savingNew.set(false);
                this.alerts.error(
                  this.t('toast.addExercise.err'),
                  this.t('toast.retry'),
                );
              },
            });
        },
        error: () => {
          this.savingNew.set(false);
          this.alerts.error(this.t('toast.def.add.err'), this.t('toast.retry'));
        },
      });
  }

  closeAddExercise(): void {
    this.showAddExercise.set(false);
    this.creatingNew.set(false);
    this.newDefName = '';
    this.newDefMuscle = '';
  }

  /** Cancel out of the inline create form — back to the picker if one exists. */
  backFromCreate(): void {
    if (this.definitions().length) this.creatingNew.set(false);
    else this.closeAddExercise();
  }

  deleteExercise(ex: WorkoutExercise): void {
    this.exerciseService.deleteExercise(this.workoutId, ex.id).subscribe({
      next: () => {
        const finished = new Set(this.finishedIds());
        finished.delete(ex.id);
        this.finishedIds.set(finished);
        if (this.activeId() === ex.id) this.activeId.set(null);
        this.loadWorkout();
      },
      error: () =>
        this.alerts.error(this.t('toast.removeExercise.err'), this.t('toast.retry')),
    });
  }

  addSet(ex: WorkoutExercise): void {
    const d = this.draft(ex.id);
    this.setService
      .createSet(ex.id, {
        setOrder: (ex.sets?.length ?? 0) + 1,
        repsAmount: d.reps,
        weightKg: d.weight,
      })
      .subscribe({
        next: () => this.loadWorkout(),
        error: () => this.alerts.error(this.t('toast.addSet.err'), this.t('toast.retry')),
      });
  }

  deleteSet(ex: WorkoutExercise, setId: number): void {
    this.setService.deleteSet(ex.id, setId).subscribe({
      next: () => this.loadWorkout(),
      error: () => this.alerts.error(this.t('toast.removeSet.err'), this.t('toast.retry')),
    });
  }

  /** Mark the current exercise done, persist its notes, advance to the next. */
  finishExercise(ex: WorkoutExercise): void {
    if ((ex.sets?.length ?? 0) === 0) return; // guarded by the disabled button too
    this.saveNotes(ex);
    const finished = new Set(this.finishedIds());
    finished.add(ex.id);
    this.finishedIds.set(finished);

    const next = this.exercises().find((e) => !finished.has(e.id));
    this.activeId.set(next ? next.id : null);
  }

  finishWorkout(): void {
    if (!this.canFinish()) return;
    const total = this.totalSets();
    this.workoutService.finishWorkout(this.workoutId).subscribe({
      next: (w) => {
        this.workout.set(w);
        this.alerts.success(
          this.t('detail.workoutDone.title'),
          this.t('detail.workoutDone.body', { n: total }),
        );
      },
      error: () =>
        this.alerts.error(this.t('toast.finish.err'), this.t('toast.retry')),
    });
  }

  /** Expand/collapse a finished exercise (in-progress) or a completed row. */
  toggleExpanded(id: number): void {
    const next = new Set(this.expandedIds());
    next.has(id) ? next.delete(id) : next.add(id);
    this.expandedIds.set(next);
  }

  isExpanded(id: number): boolean {
    return this.expandedIds().has(id);
  }

  /** Re-open a finished exercise for editing (only while the workout is live). */
  reopenExercise(ex: WorkoutExercise): void {
    const finished = new Set(this.finishedIds());
    finished.delete(ex.id);
    this.finishedIds.set(finished);
    const expanded = new Set(this.expandedIds());
    expanded.delete(ex.id);
    this.expandedIds.set(expanded);
    this.activeId.set(ex.id);
  }

  deleteWorkout(): void {
    const ref = this.modal.open(
      ModalBuilder.confirmation()
        .title(this.t('detail.deleteWorkout.title'))
        .message(this.t('detail.deleteWorkout.confirm'))
        .tone(ConfirmationTone.DANGER)
        .confirmAction({ label: this.t('action.delete'), style: ActionStyle.DANGER })
        .cancelAction({ label: this.t('action.cancel') })
        .mobileBottomSheet(true)
        .build(),
    );
    ref.afterClosed$.subscribe(({ result }) => {
      if (!result) return;
      this.workoutService.deleteWorkout(this.workoutId).subscribe({
        next: () => {
          this.alerts.success(this.t('toast.deleteWorkout.done'));
          this.router.navigate(['/workouts']);
        },
        error: () =>
          this.alerts.error(
            this.t('toast.deleteWorkout.err'),
            this.t('toast.retry'),
          ),
      });
    });
  }

  back(): void {
    this.router.navigate(['/workouts']);
  }
}
