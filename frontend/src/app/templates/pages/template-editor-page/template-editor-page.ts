import {
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable, map } from 'rxjs';
import {
  ActionStyle,
  ConfirmationTone,
  MnAlertService,
  MnLanguageService,
  MnModalService,
  MnSkeleton,
  MnTranslatePipe,
  KeyboardMode,
  ModalBuilder,
} from 'mn-angular-lib';
import { AppHeader } from '../../../layout/app-header';
import { AppIcon } from '../../../shared/app-icon';
import { errorHintKey } from '../../../shared/format';
import { ExerciseDefinitionService } from '../../../exercises/data-access/exercise-definition.service';
import {
  ExerciseDefinition,
  ExerciseType,
  isBodyweight,
} from '../../../exercises/models/exercise.model';
import { BodyweightTag } from '../../../shared/bodyweight';
import {
  SupersetRole,
  linkWithNext,
  normalizeSupersets,
  supersetLetter,
  supersetMembers,
  supersetRole,
  unlink,
} from '../../../shared/superset';
import { ExercisePicker } from '../../../workouts/components/exercise-picker/exercise-picker';
import { TargetStepper } from '../../components/target-stepper';
import { TemplateService } from '../../data-access/template.service';
import { SaveTemplate, WorkoutTemplate } from '../../models/template.model';
import { ConfirmsLeave } from '../../template-editor-leave.guard';

/** Server limits (see the template DTOs). */
const NAME_MAX = 100;
const SETS_MAX = 20;
const REPS_MAX = 1000;
const EXERCISES_MAX = 40;
const DEFAULT_SETS = 3;
const DEFAULT_REPS = 10;

/** One planned exercise while editing. */
interface Row {
  /** Stable identity for the list (the same exercise may appear twice). */
  key: number;
  /** Null when the exercise has been deleted from the catalog since. */
  definitionId: number | null;
  name: string;
  muscleGroup: string | null;
  /** Shown as a tag; targets stay sets × reps. */
  bodyweight: boolean;
  targetSets: number;
  targetReps: number;
  /** Neighbouring rows with the same number are one superset; always normalised. */
  supersetGroup: number | null;
}

/** Applies new group numbers to the rows (same order). */
function withGroups(rows: Row[], groups: (number | null)[]): Row[] {
  return rows.map((r, i) =>
    r.supersetGroup === groups[i] ? r : { ...r, supersetGroup: groups[i] },
  );
}

/** Same rule as the server, so the list always shows what will be saved. */
function normalized(rows: Row[]): Row[] {
  return withGroups(rows, normalizeSupersets(rows.map((r) => r.supersetGroup)));
}

/**
 * Create (`/templates/new`) or edit (`/templates/:id`) a template: a name and
 * an ordered list of exercises with a target of sets × reps each. Saving
 * replaces the whole template on the server.
 */
@Component({
  selector: 'app-template-editor-page',
  standalone: true,
  imports: [
    AppHeader,
    FormsModule,
    AppIcon,
    MnSkeleton,
    MnTranslatePipe,
    ExercisePicker,
    BodyweightTag,
    TargetStepper,
  ],
  templateUrl: './template-editor-page.html',
})
export class TemplateEditorPage implements OnInit, ConfirmsLeave {
  private readonly service = inject(TemplateService);
  private readonly definitionService = inject(ExerciseDefinitionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alerts = inject(MnAlertService);
  private readonly lang = inject(MnLanguageService);
  private readonly modal = inject(MnModalService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Id of the template being edited; null when creating one. */
  readonly templateId = signal<string | null>(null);
  readonly loading = signal(false);
  /** i18n key explaining why loading failed; null when it worked. */
  readonly loadError = signal<string | null>(null);

  readonly name = signal('');
  readonly rows = signal<Row[]>([]);
  readonly saving = signal(false);

  readonly definitions = signal<ExerciseDefinition[]>([]);
  readonly showPicker = signal(false);
  /** True while an exercise typed into the picker is being created. */
  readonly pickerBusy = signal(false);

  readonly nameMax = NAME_MAX;
  readonly setsMax = SETS_MAX;
  readonly repsMax = REPS_MAX;
  readonly exercisesMax = EXERCISES_MAX;

  private nextKey = 1;
  /** What is on the server (or the blank form), to tell if anything changed. */
  private readonly saved = signal('');
  /** Set once saved, so leaving the page does not ask again. */
  private leaving = false;

  readonly usedIds = computed(
    () =>
      new Set(
        this.rows()
          .map((r) => r.definitionId)
          .filter((id): id is number => id != null),
      ),
  );

  /** Catalog ids that are in the list more than once (allowed, but flagged). */
  readonly duplicateIds = computed(() => {
    const seen = new Set<number>();
    const twice = new Set<number>();
    for (const r of this.rows()) {
      if (r.definitionId == null) continue;
      if (seen.has(r.definitionId)) twice.add(r.definitionId);
      seen.add(r.definitionId);
    }
    return twice;
  });

  /** What Save would send: rows whose exercise no longer exists are dropped. */
  private readonly payload = computed<SaveTemplate>(() => ({
    name: this.name().trim().slice(0, NAME_MAX),
    exercises: normalized(this.rows().filter((r) => r.definitionId != null)).map(
      (r) => ({
        exerciseDefinitionId: r.definitionId as number,
        targetSets: r.targetSets,
        targetReps: r.targetReps,
        supersetGroup: r.supersetGroup,
      }),
    ),
  }));

  /** Per row: its place in a superset (bracket shape + letter), or nulls. */
  readonly supersets = computed<{ role: SupersetRole; letter: string | null }[]>(() => {
    const rows = this.rows();
    return rows.map((_, i) => ({
      role: supersetRole(rows, i),
      letter: supersetLetter(rows, i),
    }));
  });

  readonly dirty = computed(() => this.snapshot() !== this.saved());

  /** Why Save is disabled (i18n key), or null when it can be used. */
  readonly saveBlock = computed<string | null>(() => {
    if (!this.name().trim()) return 'templates.editor.needName';
    if (!this.payload().exercises.length) return 'templates.editor.needExercise';
    if (this.templateId() && !this.dirty()) return 'templates.editor.unchanged';
    return null;
  });

  readonly full = computed(() => this.rows().length >= EXERCISES_MAX);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.templateId.set(id);
    this.saved.set(this.snapshot());
    this.definitionService.getAll().subscribe({
      next: (d) => this.definitions.set(d),
      // The picker then only offers "create"; saving still works.
      error: () => this.definitions.set([]),
    });
    if (id) this.load();
  }

  load(): void {
    const id = this.templateId();
    if (!id) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.service.getOne(id).subscribe({
      next: (t) => {
        this.apply(t);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(
          err?.status === 404 ? 'templates.toast.gone' : errorHintKey(err),
        );
      },
    });
  }

  private apply(t: WorkoutTemplate): void {
    this.name.set(t.name);
    this.rows.set(
      normalized(
        [...t.exercises]
          .sort((a, b) => a.orderInTemplate - b.orderInTemplate)
          .map((e) => ({
            key: this.nextKey++,
            definitionId: e.exerciseDefinitionId ?? null,
            name: e.name,
            muscleGroup: e.muscleGroup ?? null,
            bodyweight: isBodyweight(e),
            targetSets: e.targetSets,
            targetReps: e.targetReps,
            supersetGroup: e.supersetGroup ?? null,
          })),
      ),
    );
    this.saved.set(this.snapshot());
  }

  /** The form as one comparable string (rows by identity, so order counts). */
  private snapshot(): string {
    return JSON.stringify([
      this.name().trim(),
      this.rows().map((r) => [
        r.definitionId,
        r.name,
        r.targetSets,
        r.targetReps,
        r.supersetGroup,
      ]),
    ]);
  }

  muscleLabel(value: string | null | undefined): string {
    if (!value) return '';
    return this.lang.translateIfPresent('muscle.' + value) ?? value;
  }

  // --- exercise list ---------------------------------------------------

  private addRow(def: ExerciseDefinition): void {
    if (this.full()) return;
    this.rows.update((rows) => [
      ...rows,
      {
        key: this.nextKey++,
        definitionId: def.id,
        name: def.name,
        muscleGroup: def.muscleGroup ?? null,
        bodyweight: isBodyweight(def),
        targetSets: DEFAULT_SETS,
        targetReps: DEFAULT_REPS,
        supersetGroup: null,
      },
    ]);
  }

  pick(def: ExerciseDefinition): void {
    this.addRow(def);
    this.showPicker.set(false);
    this.focusLater('[data-add-exercise]');
  }

  /** "Not in the list": create the catalog entry, then plan it. */
  createAndPick(dto: { name: string; muscleGroup: string; type: ExerciseType }): void {
    if (this.pickerBusy()) return;
    this.pickerBusy.set(true);
    this.definitionService
      .create({ name: dto.name, type: dto.type ?? ExerciseType.STRENGTH, muscleGroup: dto.muscleGroup })
      .subscribe({
        next: (def) => {
          this.pickerBusy.set(false);
          // The server hands back the existing entry for a name that is taken.
          if (!this.definitions().some((d) => d.id === def.id)) {
            this.definitions.update((list) => [...list, def]);
          }
          this.pick(def);
        },
        error: (err) => {
          this.pickerBusy.set(false);
          this.alerts.error(
            this.lang.t('toast.addExercise.err'),
            this.lang.t(errorHintKey(err)),
          );
        },
      });
  }

  setSets(row: Row, n: number): void {
    this.patch(row, { targetSets: n });
  }

  setReps(row: Row, n: number): void {
    this.patch(row, { targetReps: n });
  }

  private patch(row: Row, change: Partial<Row>): void {
    this.rows.update((rows) =>
      rows.map((r) => (r.key === row.key ? { ...r, ...change } : r)),
    );
  }

  move(index: number, delta: -1 | 1): void {
    const rows = [...this.rows()];
    if (index + delta < 0 || index + delta >= rows.length) return;
    const key = rows[index].key;
    // A loose row steps over a whole superset instead of splitting it; a
    // member that moves away from its partners leaves the superset.
    const alone = supersetRole(rows, index) === null;
    const steps = alone ? supersetMembers(rows, index + delta).length : 1;
    const [row] = rows.splice(index, 1);
    rows.splice(index + delta * steps, 0, row);
    this.rows.set(normalized(rows));
    // Moving the row in the DOM drops focus: put it back on the same button,
    // or on its neighbour when the row reached the top/bottom.
    const dir = delta < 0 ? 'up' : 'down';
    const other = delta < 0 ? 'down' : 'up';
    this.focusLater(
      `[data-move="${key}-${dir}"]:not(:disabled)`,
      `[data-move="${key}-${other}"]`,
    );
  }

  remove(row: Row): void {
    this.rows.update((rows) => normalized(rows.filter((r) => r.key !== row.key)));
    this.focusLater('[data-add-exercise]');
  }

  /** Superset this row with the one below it (merging with that row's superset). */
  linkNext(index: number): void {
    const rows = this.rows();
    if (index >= rows.length - 1) return;
    const key = rows[index].key;
    this.rows.set(withGroups(rows, linkWithNext(rows, index)));
    this.focusLater(`[data-ss="${key}-unlink"]`);
  }

  /** Take this row out of its superset; the others stay linked where still adjacent. */
  unlinkRow(index: number): void {
    const rows = this.rows();
    const key = rows[index].key;
    this.rows.set(withGroups(rows, unlink(rows, index)));
    this.focusLater(`[data-ss="${key}-link"]`, `[data-move="${key}-up"]:not(:disabled)`, `[data-move="${key}-down"]`);
  }

  private focusLater(...selectors: string[]): void {
    requestAnimationFrame(() => {
      for (const s of selectors) {
        const el = this.host.nativeElement.querySelector<HTMLElement>(s);
        if (el) {
          el.focus({ preventScroll: true });
          return;
        }
      }
    });
  }

  // --- save / leave ----------------------------------------------------

  save(): void {
    if (this.saveBlock() || this.saving()) return;
    const id = this.templateId();
    this.saving.set(true);
    const request = id
      ? this.service.update(id, this.payload())
      : this.service.create(this.payload());
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.leaving = true;
        this.alerts.success(
          this.lang.t('templates.toast.saved'),
        );
        this.router.navigate(['/templates']);
      },
      error: (err) => {
        this.saving.set(false);
        this.alerts.error(
          this.lang.t('templates.toast.save.err'),
          this.lang.t(
            err?.status === 404 ? 'templates.toast.gone' : errorHintKey(err),
          ),
        );
      },
    });
  }

  /** Cancel and Back both go to the list; the route guard asks when dirty. */
  back(): void {
    this.router.navigate(['/templates']);
  }

  /** Used by the route guard: ask before throwing away unsaved changes. */
  confirmLeave(): boolean | Observable<boolean> {
    if (this.leaving || !this.dirty()) return true;
    const ref = this.modal.open(
      ModalBuilder.confirmation()
        .title(this.lang.t('templates.editor.leave.title'))
        .message(this.lang.t('templates.editor.leave.confirm'))
        .tone(ConfirmationTone.DANGER)
        .confirmAction({
          label: this.lang.t('templates.editor.leave.discard'),
          style: ActionStyle.DANGER,
        })
        .cancelAction({ label: this.lang.t('templates.editor.leave.stay') })
        .mobileBottomSheet(true)
        .keyboard(KeyboardMode.ENABLED)
        .build(),
    );
    return ref.afterClosed$.pipe(map(({ result }) => !!result));
  }
}
