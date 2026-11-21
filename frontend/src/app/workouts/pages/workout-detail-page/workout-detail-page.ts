import {
  Component,
  Injector,
  OnDestroy,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Location } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable, finalize, map, of, shareReplay, tap } from 'rxjs';
import {
  MnBottomSheet,
  MnButton,
  MnInputField,
  MnSkeleton,
  MnAlertService,
  MnLanguageService,
  MnModalService,
  MnTranslatePipe,
  ModalBuilder,
  ConfirmationTone,
  ActionStyle,
  KeyboardMode,
} from 'mn-angular-lib';
import { AuthService } from '../../../auth/data-access/auth.service';
import { DecimalInput } from '../../components/decimal-input';
import { AnalysisSheet } from '../../../analysis/analysis-sheet';
import { AnalysisService } from '../../../analysis/analysis.service';
import { AppIcon } from '../../../shared/app-icon';
import { AppHeader } from '../../../layout/app-header';
import { WorkoutService } from '../../data-access/workout.service';
import { ExerciseService } from '../../../exercises/data-access/exercise.service';
import { ExerciseDefinitionService } from '../../../exercises/data-access/exercise-definition.service';
import { SetService } from '../../../exercises/data-access/set.service';
import { ProgressService } from '../../../progress/data-access/progress.service';
import { TemplateService } from '../../../templates/data-access/template.service';
import {
  ExerciseHistory,
  ExerciseSession,
  RecordKind,
  recordKind,
} from '../../../progress/models/progress.model';
import {
  Workout,
  workoutBodyweightReps,
  workoutRepCount,
  workoutVolumeKg,
  workoutSetCount,
  workingSets,
} from '../../models/workout.model';
import {
  ExerciseDefinition,
  ExerciseSet,
  ExerciseType,
  WorkoutExercise,
  isBodyweight,
} from '../../../exercises/models/exercise.model';
import {
  BodyweightTag,
  bodyweightChipText,
  bodyweightSetText,
  extraWeightText,
} from '../../../shared/bodyweight';
import {
  compactKg,
  errorHintKey,
  formatNumber,
  plural,
  relativeDay,
} from '../../../shared/format';
import { ExercisePicker } from '../../components/exercise-picker/exercise-picker';
import {
  SupersetRole,
  linkWithNext,
  normalizeSupersets,
  supersetMembers,
  supersetRole,
  unlink,
} from '../../../shared/superset';

interface SetDraft {
  /** null while the input is cleared mid-typing. */
  reps: number | null;
  weight: number | null;
  /** True once the user changed a value: never prefill over it. */
  touched: boolean;
  /** Log the next set as a warm-up (resets after every logged set). */
  warmup: boolean;
}

type PlainSet = { reps: number; weightKg: number };

/** What the lifter did before this workout, for one exercise. */
interface ExerciseRef {
  /** The earlier session shown in the "Last time" strip. */
  shown: ExerciseSession;
  /** 0 = most recent earlier session, 1 = the one before that, … */
  offset: number;
  /** How far back the ‹ control can go. */
  maxOffset: number;
  /** Best set of all earlier sessions (heaviest; most reps on a tie). */
  best: PlainSet | null;
  /** The set with the most reps of all earlier sessions (heaviest on a tie). */
  mostReps: PlainSet | null;
  /** Every working set of all earlier finished sessions, for records. */
  earlierSets: PlainSet[];
}

/** A just-deleted set that can still be put back. */
interface UndoState {
  exerciseId: number;
  setOrder: number;
  reps: number;
  weightKg: number;
  isWarmup: boolean;
}

const DEFAULT_REPS = 10;
const DEFAULT_WEIGHT = 20;
/** How many earlier sessions the "Last time" strip can page through. */
const MAX_SESSIONS_BACK = 5;
const UNDO_MS = 6000;
/** How long the "Set 2 logged" line stays under the Log button. */
const LOGGED_MS = 5000;
/** Set once the lifter has logged a set against a target: the legend is known by then. */
const TARGET_HINT_KEY = 'ironpulse.hint.targetSeen';
const APP_TITLE = 'Iron Pulse';

type ExState = 'finished' | 'active' | 'pending';

/** One exercise as rendered: where it sits and, inside a superset, its letter. */
interface ExItem {
  ex: WorkoutExercise;
  /** Position in the whole workout. */
  index: number;
  role: SupersetRole;
  /** "A" / "B" / "C" inside a superset, else null. */
  letter: string | null;
}

/** A stand-alone exercise, or the members of one superset. */
interface ExBlock {
  key: string;
  superset: boolean;
  /** "Superset · 2 exercises" */
  label: string;
  /** "Superset: Bench Press + Barbell Row" */
  aria: string;
  items: ExItem[];
}

type Arrangement = { id: number; supersetGroup: number | null }[];

const letterAt = (i: number) => String.fromCharCode(65 + (i % 26));

@Component({
  selector: 'app-workout-detail-page',
  standalone: true,
  imports: [
    AppHeader,
    FormsModule,
    NgTemplateOutlet,
    AppIcon,
    BodyweightTag,
    ExercisePicker,
    MnBottomSheet,
    MnButton,
    MnInputField,
    MnSkeleton,
    MnTranslatePipe,
    AnalysisSheet,
    DecimalInput,
  ],
  templateUrl: './workout-detail-page.html',
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class WorkoutDetailPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly title = inject(Title);
  private readonly injector = inject(Injector);
  private readonly workoutService = inject(WorkoutService);
  private readonly analysisService = inject(AnalysisService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly definitionService = inject(ExerciseDefinitionService);
  private readonly setService = inject(SetService);
  private readonly progressService = inject(ProgressService);
  private readonly templateService = inject(TemplateService);
  private readonly alerts = inject(MnAlertService);
  private readonly lang = inject(MnLanguageService);
  private readonly modal = inject(MnModalService);
  /** AI entry points ("Analyse workout") are only shown to users who may use them. */
  readonly canUseAi = inject(AuthService).canUseAi;

  private workoutId = '';
  private readonly previousTitle = this.title.getTitle();

  readonly workout = signal<Workout | null>(null);
  readonly loading = signal(true);
  readonly definitions = signal<ExerciseDefinition[]>([]);

  // Focused-accordion state (editable mode)
  readonly activeId = signal<number | null>(null);
  readonly finishedIds = signal<Set<number>>(new Set());
  /** True once the accordion state was restored/derived, so it may be persisted. */
  private readonly focusReady = signal(false);
  // Expanded rows in the read-only (finished) accordion
  readonly expandedIds = signal<Set<number>>(new Set());

  readonly exercises = computed(() => this.workout()?.exercises ?? []);
  readonly completed = computed(() => !!this.workout()?.completedAt);

  /** Exercises grouped for display: supersets become one block with lettered members. */
  readonly blocks = computed<ExBlock[]>(() => {
    const list = this.exercises();
    const out: ExBlock[] = [];
    let i = 0;
    while (i < list.length) {
      const members = supersetMembers(list, i);
      const superset = members.length > 1;
      const items = members.map((index, k) => ({
        ex: list[index],
        index,
        role: supersetRole(list, index),
        letter: superset ? letterAt(k) : null,
      }));
      out.push({
        key: (superset ? 's' : 'n') + list[i].id,
        superset,
        label: superset
          ? `${this.t('detail.superset')} · ${members.length} ${this.t('unit.exercises')}`
          : '',
        aria: superset
          ? this.t('detail.aria.superset', { names: items.map((it) => it.ex.name).join(' + ') })
          : '',
        items,
      });
      i += members.length;
    }
    return out;
  });

  // Reorder mode: every exercise is a compact row with move / superset controls.
  readonly reordering = signal(false);
  /** Screen-reader announcement after a move. */
  readonly moveAnnouncement = signal('');
  private arrangeInFlight = false;
  private arrangeDirty = false;
  /** Last arrangement the server confirmed, to fall back on when a save fails. */
  private arrangeBase: Arrangement | null = null;

  /** A workout can be finished only when every exercise has at least one set. */
  readonly canFinish = computed(() => {
    const ex = this.exercises();
    return ex.length > 0 && ex.every((e) => (e.sets?.length ?? 0) > 0);
  });

  /** Why "Finish workout" is blocked, or null when it's allowed. */
  readonly finishBlock = computed<
    { key: string; name?: string; exercise?: WorkoutExercise } | null
  >(() => {
    const ex = this.exercises();
    if (ex.length === 0) return { key: 'detail.finish.needExercise' };
    const empty = ex.find((e) => (e.sets?.length ?? 0) === 0);
    if (empty) return { key: 'detail.finish.needSet', name: empty.name, exercise: empty };
    return null;
  });

  /**
   * Progress against the template plan: working sets done (capped per
   * exercise at its target, so extras never hide a skipped set) out of all
   * planned sets. Null when no exercise in this workout has a target.
   */
  readonly planned = computed<{ done: number; total: number } | null>(() => {
    let done = 0;
    let total = 0;
    for (const ex of this.exercises()) {
      const target = this.targetSets(ex);
      if (!target) continue;
      total += target;
      done += Math.min(target, workingSets(ex).length);
    }
    return total > 0 ? { done, total } : null;
  });

  readonly volume = computed(() => {
    const w = this.workout();
    return w ? workoutVolumeKg(w) : 0;
  });
  /** Exercises whose note field was opened by hand (it stays hidden until wanted). */
  readonly noteOpen = signal<Set<number>>(new Set());

  openNote(exerciseId: number): void {
    this.noteOpen.update((s) => new Set(s).add(exerciseId));
    // Put the cursor in the field that just appeared.
    setTimeout(() => document.getElementById('note-' + exerciseId)?.focus());
  }

  /** The AI analysis of this workout; only asked for when opened. */
  readonly showAnalysis = signal(false);

  readonly totalReps = computed(() => {
    const w = this.workout();
    return w ? workoutRepCount(w) : 0;
  });
  /** Reps on bodyweight exercises: shown next to the volume of a mixed workout. */
  readonly bodyweightReps = computed(() => {
    const w = this.workout();
    return w ? workoutBodyweightReps(w) : 0;
  });
  readonly totalSets = computed(() => {
    const w = this.workout();
    return w ? workoutSetCount(w) : 0;
  });
  readonly finishedCount = computed(() => {
    const ids = this.finishedIds();
    return this.exercises().filter((e) => ids.has(e.id)).length;
  });

  /** Catalog ids already in this workout: flagged in the picker. */
  readonly usedDefinitionIds = computed(
    () =>
      new Set(
        this.exercises()
          .map((e) => e.exerciseDefinitionId)
          .filter((id): id is number => id != null),
      ),
  );

  /** Per-definition history, loaded lazily; null = never logged / failed. */
  private readonly history = signal<Map<number, ExerciseHistory | null>>(new Map());
  private readonly historyRequested = new Set<number>();
  /** Which earlier session the "Last time" strip shows, per workout-exercise id. */
  private readonly refOffsets = signal<Map<number, number>>(new Map());

  /**
   * "Previous" data per workout-exercise id: sessions of the same exercise in
   * finished workouts that came strictly before this one (earlier date, or
   * created earlier on the same day). Unfinished or later workouts never
   * count as "last time". Absent when there is none.
   */
  readonly refs = computed(() => {
    const out = new Map<number, ExerciseRef>();
    const w = this.workout();
    if (!w) return out;
    const hist = this.history();
    const offsets = this.refOffsets();
    const wDate = (w.date ?? '').slice(0, 10);
    const wCreated = w.createdAt ? new Date(w.createdAt).getTime() : Infinity;
    for (const ex of w.exercises ?? []) {
      if (ex.exerciseDefinitionId == null) continue;
      const h = hist.get(ex.exerciseDefinitionId);
      if (!h) continue;
      const prev = h.sessions.filter((s) => {
        if (String(s.workoutId) === String(w.id)) return false;
        if (!s.completed || !s.sets.length) return false;
        const sDate = (s.date ?? '').slice(0, 10);
        if (sDate !== wDate) return sDate < wDate;
        return new Date(s.workoutCreatedAt).getTime() < wCreated;
      });
      if (!prev.length) continue;
      const earlierSets: PlainSet[] = [];
      let best: PlainSet | null = null;
      let mostReps: PlainSet | null = null;
      for (const s of prev) {
        for (const set of s.sets) {
          const p = { reps: Number(set.reps), weightKg: Number(set.weightKg) };
          if (!(p.reps > 0)) continue;
          earlierSets.push(p);
          if (
            !mostReps ||
            p.reps > mostReps.reps ||
            (p.reps === mostReps.reps && p.weightKg > mostReps.weightKg)
          ) {
            mostReps = p;
          }
          if (
            !best ||
            p.weightKg > best.weightKg ||
            (p.weightKg === best.weightKg && p.reps > best.reps)
          ) {
            best = p;
          }
        }
      }
      const maxOffset = Math.min(prev.length, MAX_SESSIONS_BACK) - 1;
      const offset = Math.min(offsets.get(ex.id) ?? 0, maxOffset);
      out.set(ex.id, {
        shown: prev[prev.length - 1 - offset],
        offset,
        maxOffset,
        best,
        mostReps,
        earlierSets,
      });
    }
    return out;
  });

  /**
   * Working sets of this workout that are a personal record, with the kind:
   * heavier than ever ('weight') or more reps than ever at that weight or
   * heavier ('reps'): compared with every earlier finished session plus the
   * earlier working sets of this workout. Warm-ups never count.
   */
  readonly prSets = computed(() => {
    const out = new Map<number, RecordKind>();
    const refs = this.refs();
    for (const ex of this.exercises()) {
      const ref = refs.get(ex.id);
      if (!ref) continue; // first time ever: nothing to beat yet
      const earlier = [...ref.earlierSets];
      for (const set of workingSets(ex)) {
        const p = { reps: Number(set.repsAmount), weightKg: Number(set.weightKg) };
        const kind = recordKind(p, earlier);
        // Only a heavier weight is a record; reps count for bodyweight work, which has no weight to beat.
        if (kind === 'weight' || (kind && isBodyweight(ex))) out.set(set.setId, kind);
        earlier.push(p);
      }
    }
    return out;
  });

  // Inline editor for an already-logged set
  readonly editingSetId = signal<number | null>(null);
  readonly savingSet = signal(false);
  editReps: number | null = null;
  editWeight: number | null = null;
  readonly editWarmup = signal(false);

  // "Edit workout details" bottom sheet
  readonly showEdit = signal(false);
  readonly savingEdit = signal(false);
  readonly editName = signal('');
  readonly editDate = signal('');
  editNote = '';
  /** Why "Save" is disabled in the edit sheet, or null when it is allowed. */
  readonly editBlock = computed<string | null>(() => {
    if (!this.editName().trim()) return 'detail.edit.needName';
    if (!this.editDate()) return 'detail.edit.needDate';
    return null;
  });

  // In-flight guards: a second tap while a request runs must do nothing.
  readonly logging = signal(false);
  readonly reopening = signal(false);
  readonly finishing = signal(false);
  readonly adding = signal(false);
  readonly finishingExerciseId = signal<number | null>(null);
  readonly deletingSetIds = signal<Set<number>>(new Set());
  private removingExercise = false;
  private deletingWorkout = false;

  /** The last deleted set, offered back for a few seconds. */
  readonly undo = signal<UndoState | null>(null);
  readonly restoring = signal(false);
  private undoTimer: ReturnType<typeof setTimeout> | null = null;

  readonly showAddExercise = signal(false);

  /** The set that was just logged: confirmed under the Log button and flashed in the list. */
  readonly lastLogged = signal<{ exerciseId: number; setId: number | null; text: string } | null>(
    null,
  );
  private loggedTimer: ReturnType<typeof setTimeout> | null = null;

  /** Spell the target line out ("3 sets of 8 reps") until a set was logged against one. */
  readonly showTargetHint = signal(!WorkoutDetailPage.targetHintSeen());

  // "Save as template" bottom sheet (finished workouts only)
  readonly showSaveTemplate = signal(false);
  readonly savingTemplate = signal(false);
  readonly templateName = signal('');

  /** Toasts that would contradict each other if both stayed on screen. */
  private finishedToastId: string | null = null;
  private reopenedToastId: string | null = null;

  /** Bumped when a draft changes outside an input event (zoneless re-render). */
  private readonly draftTick = signal(0);
  private readonly drafts = new Map<number, SetDraft>();
  private readonly noteDrafts = new Map<number, string>();
  private readonly noteSaves = new Map<number, { text: string; obs: Observable<void> }>();

  t = (k: string, p?: Record<string, string | number>) => this.lang.t(k, p);
  readonly plural = plural;
  readonly rel = (d: string) =>
    relativeDay((d ?? '').slice(0, 10), (k, p) => this.lang.t(k, p), this.lang.locale);
  /** Localized number: 67.5 -> "67.5" / "67,5" (decimal columns may arrive as strings). */
  readonly num = (n: number | string) => formatNumber(n, this.lang.locale);

  constructor() {
    // Tab title = workout name while this page is open.
    effect(() => {
      const w = this.workout();
      if (w?.name) this.title.setTitle(`${w.name} · ${APP_TITLE}`);
    });
    // Remember which exercises are finished / active across reloads.
    effect(() => {
      const finished = this.finishedIds();
      const active = this.activeId();
      if (!this.focusReady() || this.completed()) return;
      try {
        localStorage.setItem(
          this.focusKey(),
          JSON.stringify({ finished: [...finished], active }),
        );
      } catch {
        /* storage unavailable: the state just won't survive a reload */
      }
    });
  }

  ngOnInit(): void {
    this.workoutId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadWorkout({ initFocus: true });
    this.loadDefinitions();
  }

  ngOnDestroy(): void {
    this.title.setTitle(this.previousTitle || APP_TITLE);
    if (this.undoTimer) clearTimeout(this.undoTimer);
    if (this.loggedTimer) clearTimeout(this.loggedTimer);
  }

  private static targetHintSeen(): boolean {
    try {
      return localStorage.getItem(TARGET_HINT_KEY) === '1';
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------- loading

  private loadWorkout(opts: { initFocus?: boolean; then?: () => void } = {}): void {
    this.workoutService.getWorkout(this.workoutId).subscribe({
      next: (w) => {
        if (this.arrangeInFlight && w.exercises) {
          // A reorder is still being saved: keep showing the order on screen.
          w = { ...w, exercises: this.arrangedLike(w.exercises, this.snapshot()) };
        }
        this.workout.set(w);
        for (const ex of w.exercises ?? []) {
          if (!this.noteDrafts.has(ex.id)) this.noteDrafts.set(ex.id, ex.notes ?? '');
          if (ex.exerciseDefinitionId != null) this.ensureHistory(ex.exerciseDefinitionId);
        }
        this.applyPrefill();
        if (opts.initFocus) this.initFocus(w);
        this.loading.set(false);
        opts.then?.();
      },
      error: (err) => {
        // Only bounce away when there is nothing to show at all.
        if (!this.workout()) {
          this.loading.set(false);
          this.alerts.error(this.t('toast.load.err.title'), this.t(errorHintKey(err)));
          this.router.navigate(['/workouts']);
        }
      },
    });
  }

  private focusKey(): string {
    return `ironpulse.workoutFocus.${this.workoutId}`;
  }

  private clearStoredFocus(): void {
    this.focusReady.set(false);
    try {
      localStorage.removeItem(this.focusKey());
    } catch {
      /* ignore */
    }
  }

  private readStoredFocus(): { finished: number[]; active: number | null } | null {
    try {
      const raw = localStorage.getItem(this.focusKey());
      if (!raw) return null;
      const v = JSON.parse(raw) as { finished?: unknown; active?: unknown };
      if (!Array.isArray(v.finished)) return null;
      return {
        finished: v.finished.filter((x): x is number => typeof x === 'number'),
        active: typeof v.active === 'number' ? v.active : null,
      };
    } catch {
      return null;
    }
  }

  private initFocus(w: Workout): void {
    if (w.completedAt) {
      // Finished: read-only accordion, first exercise expanded.
      this.expandedIds.set(
        w.exercises?.length ? new Set([w.exercises[0].id]) : new Set(),
      );
      this.clearStoredFocus();
      return;
    }
    const exercises = w.exercises ?? [];
    const stored = this.readStoredFocus();
    if (stored) {
      // Pick up exactly where the lifter left off.
      const ids = new Set(exercises.map((e) => e.id));
      const finished = new Set(stored.finished.filter((id) => ids.has(id)));
      const active =
        stored.active != null && ids.has(stored.active) && !finished.has(stored.active)
          ? stored.active
          : null;
      this.finishedIds.set(finished);
      this.activeId.set(active);
    } else {
      // Nothing remembered (other device, reopened workout): exercises with
      // sets count as done and the first unlogged one is in focus.
      const done = new Set<number>();
      let firstUnlogged: number | null = null;
      for (const ex of exercises) {
        if ((ex.sets?.length ?? 0) > 0) done.add(ex.id);
        else if (firstUnlogged === null) firstUnlogged = ex.id;
      }
      this.finishedIds.set(done);
      this.activeId.set(firstUnlogged);
    }
    this.focusReady.set(true);
  }

  /** Fetch an exercise's history once; 404 (never logged) just means "no reference". */
  private ensureHistory(definitionId: number): void {
    if (this.historyRequested.has(definitionId)) return;
    this.historyRequested.add(definitionId);
    this.progressService.getExerciseHistory(definitionId).subscribe({
      next: (h) => {
        this.history.update((m) => new Map(m).set(definitionId, h));
        this.applyPrefill();
      },
      error: () => this.history.update((m) => new Map(m).set(definitionId, null)),
    });
  }

  /**
   * Seed untouched drafts: follow the reference session set-by-set, else
   * continue from the last set logged today, else 10 × 20. A suggested weight
   * (planned workout) wins for the first working set; after that the lifter's
   * own sets lead again.
   */
  private applyPrefill(): void {
    const refs = this.refs();
    for (const ex of this.exercises()) {
      const d = this.draft(ex.id);
      if (d.touched) continue;
      const sets = workingSets(ex);
      const prev = refs.get(ex.id)?.shown.sets ?? [];
      const target = prev[sets.length];
      if (target) {
        d.reps = Number(target.reps);
        d.weight = Number(target.weightKg);
      } else if (sets.length) {
        const last = sets[sets.length - 1];
        d.reps = Number(last.repsAmount);
        d.weight = Number(last.weightKg);
      } else if (prev.length) {
        const last = prev[prev.length - 1];
        d.reps = Number(last.reps);
        d.weight = Number(last.weightKg);
      }
      // A planned exercise: the plan decides the reps, last time the weight.
      const planReps = this.targetReps(ex);
      if (planReps) d.reps = planReps;
      const planWeight = this.targetWeight(ex);
      if (planWeight != null && !sets.length) d.weight = planWeight;
    }
    this.draftTick.update((n) => n + 1);
  }

  private loadDefinitions(): void {
    this.definitionService.getAll().subscribe({
      next: (d) => this.definitions.set(d),
      error: () => {},
    });
  }

  // ------------------------------------------------------------- formatting

  /** Translated muscle-group label, falling back to the raw stored value. */
  muscleLabel(value: string | null | undefined): string {
    if (!value) return '';
    return this.lang.translateIfPresent('muscle.' + value) ?? value;
  }

  /** Bodyweight exercise: its weights are extra weight on top of body weight. */
  readonly isBw = isBodyweight;

  /**
   * "9 × 67,5 kg"; bodyweight exercise: "12 reps" / "8 reps · +10 kg"; a
   * weights exercise done at 0 kg: "12 reps · no extra weight" (no "BW"
   * abbreviation where there is room for the words).
   */
  setText(reps: number | string, kg: number | string, bw = false): string {
    if (bw) return bodyweightSetText(reps, kg, this.t, this.lang.locale);
    if (Number(kg) === 0) {
      return `${bodyweightSetText(reps, 0, this.t, this.lang.locale)} · ${this.t('bw.plain')}`;
    }
    return `${this.num(reps)} × ${this.num(kg)} ${this.t('unit.kg')}`;
  }

  /**
   * "Best so far" of a bodyweight exercise: the most reps AND the heaviest
   * extra weight, e.g. "12 reps · heaviest +10 kg × 6".
   */
  bestText(ex: WorkoutExercise, ref: ExerciseRef): string {
    const best = ref.best;
    if (!best) return '';
    if (!isBodyweight(ex)) return this.setText(best.reps, best.weightKg);
    const most = ref.mostReps ?? best;
    const out = bodyweightSetText(most.reps, most.weightKg, this.t, this.lang.locale);
    if (best.weightKg > 0 && best.weightKg > most.weightKg) {
      const set = `${extraWeightText(best.weightKg, this.t, this.lang.locale)} × ${this.num(best.reps)}`;
      return `${out} · ${this.t('bw.best.heaviest', { set })}`;
    }
    return out;
  }

  /** Compact chip text without the unit: "9 × 67,5" / "12 × BW". */
  chipText(reps: number | string, kg: number | string, bw = false): string {
    if (bw) return bodyweightChipText(reps, kg, this.t, this.lang.locale);
    return `${this.num(reps)} × ${Number(kg) === 0 ? this.t('unit.bw') : this.num(kg)}`;
  }

  exerciseVolume(ex: WorkoutExercise): number {
    return workingSets(ex).reduce(
      (s, set) => s + Number(set.repsAmount) * Number(set.weightKg),
      0,
    );
  }

  /** Number of working (non warm-up) sets logged for this exercise. */
  workingCount(ex: WorkoutExercise): number {
    return workingSets(ex).length;
  }

  /** "3 sets" / "1 set", plus `sep` + "1 warm-up" when there are warm-ups. */
  private setsText(working: number, warmups: number, sep: string): string {
    let out = `${working} ${this.t(plural(working, 'unit.sets'))}`;
    if (warmups > 0) {
      out += `${sep}${warmups} ${this.t(plural(warmups, 'detail.warmupCount'))}`;
    }
    return out;
  }

  // ------------------------------------------------------------------ plan

  /** Planned working sets (from a template), or null for a hand-added exercise. */
  targetSets(ex: WorkoutExercise): number | null {
    const n = Number(ex.targetSets);
    return n > 0 ? n : null;
  }

  /** Planned reps per set, or null when there is no plan. */
  targetReps(ex: WorkoutExercise): number | null {
    const n = Number(ex.targetReps);
    return this.targetSets(ex) && n > 0 ? n : null;
  }

  /**
   * Suggested working weight of a planned exercise, or null. For a bodyweight
   * exercise it is the extra weight (0 = none); elsewhere 0 means "no advice".
   */
  targetWeight(ex: WorkoutExercise): number | null {
    if (ex.targetWeightKg == null || !this.targetSets(ex)) return null;
    const n = Number(ex.targetWeightKg);
    if (!Number.isFinite(n) || n < 0) return null;
    return n > 0 || isBodyweight(ex) ? n : null;
  }

  /** "70 kg" / "+10 kg" (bodyweight); '' when there is nothing to show. */
  private targetWeightText(ex: WorkoutExercise): string {
    const kg = this.targetWeight(ex);
    if (!kg) return '';
    return isBodyweight(ex)
      ? extraWeightText(kg, this.t, this.lang.locale)
      : `${this.num(kg)} ${this.t('unit.kg')}`;
  }

  /**
   * The one way a target is shown: "Target 4 × 8 · 70 kg" (bodyweight:
   * "· +10 kg"; just the set count if reps are unknown).
   */
  planText(ex: WorkoutExercise): string {
    const sets = this.targetSets(ex) ?? 0;
    const reps = this.targetReps(ex);
    const base = this.t('detail.plan.target', { sets, reps: reps ?? '' }).replace(
      /\s×\s(?=\s|$)/,
      '',
    );
    const weight = this.targetWeightText(ex);
    return weight ? `${base} · ${weight}` : base;
  }

  /** The target spelled out for beginners and screen readers: "3 sets of 8 reps at 70 kg". */
  planLegend(ex: WorkoutExercise): string {
    const sets = this.targetSets(ex) ?? 0;
    const reps = this.targetReps(ex);
    const legend = reps
      ? this.t(plural(sets, 'detail.plan.legend'), { sets, reps })
      : `${sets} ${this.t(plural(sets, 'unit.sets'))}`;
    const weight = this.targetWeightText(ex);
    return weight ? this.t('detail.plan.legend.weight', { legend, weight }) : legend;
  }

  /** "2 of 4 sets": working sets against the plan. */
  planSetsText(ex: WorkoutExercise): string {
    const total = this.targetSets(ex) ?? 0;
    return this.t(plural(total, 'detail.plan.sets'), {
      done: workingSets(ex).length,
      total,
    });
  }

  /** "8 reps" for a placeholder row of a planned set. */
  planRepsText(ex: WorkoutExercise): string {
    const reps = this.targetReps(ex);
    return reps ? `${reps} ${this.t(plural(reps, 'unit.reps'))}` : '';
  }

  /** "2 sets short of plan" / "1 set more than planned" for a finished row; '' when on plan. */
  planDeltaText(ex: WorkoutExercise): string {
    const delta = this.planDelta(ex);
    if (!delta) return '';
    const n = Math.abs(delta);
    return this.t(plural(n, delta < 0 ? 'detail.plan.short' : 'detail.plan.extra'), { n });
  }

  /** "2 of 4 exercises finished". */
  progressText(): string {
    const total = this.exercises().length;
    return this.t(plural(total, 'detail.progress'), { done: this.finishedCount(), total });
  }

  /** Width of the header bar: planned sets when there is a plan, else finished exercises. */
  progressPct(): number {
    const p = this.planned();
    if (p) return (p.done / p.total) * 100;
    const total = this.exercises().length;
    return total ? (this.finishedCount() / total) * 100 : 0;
  }

  /** Numbers of the planned working sets that are still to be logged. */
  remainingPlan(ex: WorkoutExercise): number[] {
    const target = this.targetSets(ex);
    if (!target) return [];
    const done = workingSets(ex).length;
    const out: number[] = [];
    for (let n = done + 1; n <= target; n++) out.push(n);
    return out;
  }

  /** One entry per planned set for the progress bar: true = done. */
  planSegments(ex: WorkoutExercise): boolean[] {
    const target = this.targetSets(ex) ?? 0;
    const done = workingSets(ex).length;
    return Array.from({ length: target }, (_, i) => i < done);
  }

  targetReached(ex: WorkoutExercise): boolean {
    const target = this.targetSets(ex);
    return !!target && workingSets(ex).length >= target;
  }

  /** Working sets done minus planned: <0 fell short, >0 went beyond, 0/null nothing to flag. */
  planDelta(ex: WorkoutExercise): number | null {
    const target = this.targetSets(ex);
    return target ? workingSets(ex).length - target : null;
  }

  /** "11 of 13 planned sets", or '' without a plan. */
  plannedText(): string {
    const p = this.planned();
    if (!p) return '';
    return this.t(plural(p.total, 'detail.plan.summary'), { done: p.done, total: p.total });
  }

  /** Row summary: "3 sets · 1 warm-up · 1.8k kg" ("3 of 4 sets · …" with a plan). */
  exerciseMeta(ex: WorkoutExercise): string {
    const working = workingSets(ex).length;
    const warmups = (ex.sets?.length ?? 0) - working;
    const parts = [
      this.targetSets(ex)
        ? this.planSetsText(ex) +
          (warmups > 0
            ? ` · ${warmups} ${this.t(plural(warmups, 'detail.warmupCount'))}`
            : '')
        : this.setsText(working, warmups, ' · '),
    ];
    if (isBodyweight(ex)) {
      // Volume says nothing here (only the extra weight is known): total reps.
      const reps = workingSets(ex).reduce((n, set) => n + Number(set.repsAmount), 0);
      if (reps > 0) parts.push(`${this.num(reps)} ${this.t(plural(reps, 'unit.reps'))}`);
      // Weighted bodyweight work: say how heavy it got.
      const top = Math.max(0, ...workingSets(ex).map((set) => Number(set.weightKg) || 0));
      if (top > 0) {
        parts.push(
          this.t('bw.upTo', { weight: extraWeightText(top, this.t, this.lang.locale) }),
        );
      }
      return parts.join(' · ');
    }
    const vol = this.exerciseVolume(ex);
    if (vol > 0) parts.push(`${compactKg(vol, this.lang.locale)} ${this.t('unit.kg')}`);
    return parts.join(' · ');
  }

  volumeText(): string {
    return compactKg(this.volume(), this.lang.locale);
  }

  /** "27 reps": the bodyweight work of a mixed workout, shown under its volume. */
  bodyweightRepsText(): string {
    const reps = this.bodyweightReps();
    return `${this.num(reps)} ${this.t(plural(reps, 'unit.reps'))}`;
  }

  /** Badge for a set row: "W" for a warm-up, else its number among working sets. */
  setLabel(ex: WorkoutExercise, set: ExerciseSet): string {
    if (set.isWarmup) return this.t('detail.warmup.badge');
    return String(workingSets(ex).findIndex((s) => s.setId === set.setId) + 1);
  }

  /** "Edit set 2" / "Remove warm-up set 1" for the set-row buttons. */
  setAria(ex: WorkoutExercise, set: ExerciseSet, action: 'edit' | 'remove'): string {
    const same = (ex.sets ?? []).filter((s) => !!s.isWarmup === !!set.isWarmup);
    const n = same.findIndex((s) => s.setId === set.setId) + 1;
    return this.t(`detail.aria.${action}${set.isWarmup ? 'Warmup' : 'Set'}`, { n });
  }

  /** Badge text for a record set: which kind of record it is. */
  prLabel(set: ExerciseSet): string {
    const kind = this.prSets().get(set.setId);
    if (!kind) return '';
    return this.t(this.prKey(kind, Number(set.weightKg)));
  }

  private prKey(kind: RecordKind, weightKg: number): string {
    if (kind === 'weight') return 'detail.pr.weight';
    return weightKg === 0 ? 'detail.pr.reps.bw' : 'detail.pr.reps';
  }

  /** Whole days between a yyyy-mm-dd date and today. */
  private daysAgo(dateStr: string): number {
    const date = new Date((dateStr ?? '').slice(0, 10) + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((today.getTime() - date.getTime()) / 86_400_000);
  }

  /** "Mon 19 Oct · 26 days ago" for older sessions, else the relative day. */
  refDate(dateStr: string): string {
    const days = this.daysAgo(dateStr);
    const base = this.rel(dateStr);
    return days >= 7 ? `${base} · ${this.t('date.daysAgo', { n: days })}` : base;
  }

  /** Look at an earlier (+1) or later (-1) reference session; prefill follows it. */
  shiftRef(ex: WorkoutExercise, delta: number): void {
    const ref = this.refs().get(ex.id);
    if (!ref) return;
    const next = Math.max(0, Math.min(ref.maxOffset, ref.offset + delta));
    if (next === ref.offset) return;
    this.refOffsets.update((m) => new Map(m).set(ex.id, next));
    const shown = this.refs().get(ex.id)?.shown.sets ?? [];
    const target = shown[workingSets(ex).length] ?? shown[shown.length - 1];
    if (target) {
      const d = this.draft(ex.id);
      d.reps = this.targetReps(ex) ?? Number(target.reps);
      // The suggested weight keeps the first set, like in applyPrefill.
      const planWeight = workingSets(ex).length ? null : this.targetWeight(ex);
      d.weight = planWeight ?? Number(target.weightKg);
      d.touched = false;
      this.draftTick.update((n) => n + 1);
    }
  }

  // ------------------------------------------------------------ accordion

  state(ex: WorkoutExercise): ExState {
    if (this.finishedIds().has(ex.id)) return 'finished';
    return this.activeId() === ex.id ? 'active' : 'pending';
  }

  /** Switch to another exercise; the previous one simply becomes pending again. */
  setActive(ex: WorkoutExercise): void {
    this.editingSetId.set(null);
    this.activeId.set(ex.id);
    this.scrollToExercise(ex.id);
  }

  private scrollToExercise(id: number): void {
    afterNextRender(
      () =>
        document
          .getElementById('ex-' + id)
          ?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
      { injector: this.injector },
    );
  }

  // ------------------------------------------------------------ supersets

  /** The superset member that is up after `exerciseId` (round-robin, skipping finished ones). */
  private nextMember(exerciseId: number): { ex: WorkoutExercise; letter: string } | null {
    const list = this.exercises();
    const i = list.findIndex((e) => e.id === exerciseId);
    if (i < 0) return null;
    const members = supersetMembers(list, i);
    if (members.length < 2) return null;
    const pos = members.indexOf(i);
    const finished = this.finishedIds();
    for (let k = 1; k < members.length; k++) {
      const at = (pos + k) % members.length;
      const ex = list[members[at]];
      if (!finished.has(ex.id)) return { ex, letter: letterAt(at) };
    }
    return null;
  }

  /** "Next: B · Barbell Row" for the active card, or '' outside a superset. */
  supersetNext(ex: WorkoutExercise): string {
    const next = this.nextMember(ex.id);
    return next
      ? this.t('detail.superset.next', { letter: next.letter, name: next.ex.name })
      : '';
  }

  /** After a working set: hand over to the next member of the superset. */
  private rotateSuperset(exerciseId: number): number | null {
    if (this.activeId() !== exerciseId || this.reordering()) return null;
    const next = this.nextMember(exerciseId);
    if (!next) return null;
    this.editingSetId.set(null);
    this.activeId.set(next.ex.id);
    this.scrollToExercise(next.ex.id);
    return next.ex.id;
  }

  // -------------------------------------------------------------- reorder

  toggleReorder(): void {
    if (this.reordering()) {
      this.reordering.set(false);
      this.moveAnnouncement.set('');
      const active = this.activeId();
      if (active != null) this.scrollToExercise(active);
      return;
    }
    if (this.completed() || this.exercises().length < 2) return;
    this.editingSetId.set(null);
    this.closeAddExercise();
    this.reordering.set(true);
  }

  private snapshot(): Arrangement {
    return this.exercises().map((e) => ({ id: e.id, supersetGroup: e.supersetGroup ?? null }));
  }

  /** `list` in the order (and with the grouping) of `order`; unknown exercises go last. */
  private arrangedLike(list: WorkoutExercise[], order: Arrangement): WorkoutExercise[] {
    const byId = new Map(list.map((e) => [e.id, e]));
    const out: WorkoutExercise[] = [];
    for (const o of order) {
      const ex = byId.get(o.id);
      if (!ex) continue;
      byId.delete(o.id);
      out.push({ ...ex, supersetGroup: o.supersetGroup });
    }
    for (const ex of list) if (byId.has(ex.id)) out.push(ex);
    return out.map((e, i) => ({ ...e, orderInWorkout: i + 1 }));
  }

  /** Show the new order/grouping right away, then save it. */
  private applyArrangement(order: Arrangement): void {
    if (!this.arrangeInFlight) this.arrangeBase = this.snapshot();
    this.workout.update((w) =>
      w ? { ...w, exercises: this.arrangedLike(w.exercises ?? [], order) } : w,
    );
    this.saveArrangement();
  }

  /** One save at a time; changes made meanwhile go out in a follow-up save. */
  private saveArrangement(): void {
    if (this.arrangeInFlight) {
      this.arrangeDirty = true;
      return;
    }
    this.arrangeInFlight = true;
    this.exerciseService.arrange(this.workoutId, this.snapshot()).subscribe({
      next: (saved) => {
        this.arrangeInFlight = false;
        const confirmed = saved.map((e) => ({
          id: e.id,
          supersetGroup: e.supersetGroup ?? null,
        }));
        if (this.arrangeDirty) {
          this.arrangeDirty = false;
          this.arrangeBase = confirmed;
          this.saveArrangement();
          return;
        }
        this.arrangeBase = null;
        this.workout.update((w) =>
          w ? { ...w, exercises: this.arrangedLike(w.exercises ?? [], confirmed) } : w,
        );
      },
      error: (err) => {
        this.arrangeInFlight = false;
        this.arrangeDirty = false;
        const base = this.arrangeBase;
        this.arrangeBase = null;
        if (base) {
          this.workout.update((w) =>
            w ? { ...w, exercises: this.arrangedLike(w.exercises ?? [], base) } : w,
          );
        }
        this.moveAnnouncement.set('');
        this.alerts.error(this.t('toast.arrange.err'), this.t(errorHintKey(err)));
        // The server may know better (finished on another device, removed exercise).
        this.loadWorkout();
      },
    });
  }

  /**
   * Move an exercise one step. Inside its superset it swaps places with a
   * partner; stepping out of the superset takes it out; a stand-alone
   * exercise hops over a whole superset instead of splitting it.
   */
  moveExercise(index: number, dir: -1 | 1): void {
    const list = this.exercises();
    const target = index + dir;
    if (this.completed() || index < 0 || target < 0 || target >= list.length) return;
    const groups = normalizeSupersets(list.map((e) => e.supersetGroup));
    const order: Arrangement = list.map((e, i) => ({ id: e.id, supersetGroup: groups[i] }));
    const theirs = supersetMembers(order, target);
    const staysInside = supersetMembers(order, index).includes(target);
    const [item] = order.splice(index, 1);
    if (staysInside) {
      order.splice(target, 0, item);
    } else {
      item.supersetGroup = null;
      const dest = theirs.length > 1 ? (dir > 0 ? theirs[theirs.length - 1] : theirs[0]) : target;
      order.splice(dest, 0, item);
    }
    const normalized = normalizeSupersets(order.map((o) => o.supersetGroup));
    order.forEach((o, i) => (o.supersetGroup = normalized[i]));
    const moved = list[index];
    this.applyArrangement(order);
    this.moveAnnouncement.set(
      this.t('detail.reorder.moved', {
        name: moved.name,
        n: order.findIndex((o) => o.id === moved.id) + 1,
        total: order.length,
      }),
    );
    // Keep the moved row in view and the same arrow under the thumb / in focus.
    afterNextRender(
      () => {
        const pick = (d: -1 | 1) =>
          document.getElementById(`ro-${d < 0 ? 'up' : 'down'}-${moved.id}`) as
            | HTMLButtonElement
            | null;
        let btn = pick(dir);
        if (!btn || btn.disabled) btn = pick(dir < 0 ? 1 : -1);
        btn?.focus({ preventScroll: true });
        document
          .getElementById('ro-' + moved.id)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      },
      { injector: this.injector },
    );
  }

  /** Tie the exercise to the one below it (joining whatever superset that one is in). */
  linkNext(index: number): void {
    const list = this.exercises();
    if (this.completed() || index < 0 || index >= list.length - 1) return;
    const groups = linkWithNext(list, index);
    this.applyArrangement(list.map((e, i) => ({ id: e.id, supersetGroup: groups[i] })));
    this.moveAnnouncement.set(
      this.t('detail.reorder.linked', { name: list[index].name, next: list[index + 1].name }),
    );
    // "Superset with next" is gone after the re-render: its counterpart takes the focus.
    this.focusReorderControl(list[index].id, ['unlink', 'link', 'up', 'down']);
  }

  /** Focus the first of these controls of a reorder row that exists and is enabled. */
  private focusReorderControl(
    exerciseId: number,
    order: ('link' | 'unlink' | 'up' | 'down')[],
  ): void {
    afterNextRender(
      () => {
        for (const kind of order) {
          const el = document.getElementById(`ro-${kind}-${exerciseId}`) as
            | HTMLButtonElement
            | null;
          if (el && !el.disabled) {
            el.focus({ preventScroll: true });
            return;
          }
        }
      },
      { injector: this.injector },
    );
  }

  /** Take the exercise out of its superset (it keeps its place in the workout). */
  unlinkExercise(index: number): void {
    const list = this.exercises();
    if (this.completed() || !list[index]) return;
    const groups = unlink(list, index);
    this.applyArrangement(list.map((e, i) => ({ id: e.id, supersetGroup: groups[i] })));
    this.moveAnnouncement.set(this.t('detail.reorder.unlinked', { name: list[index].name }));
    this.focusReorderControl(list[index].id, ['unlink', 'link', 'up', 'down']);
  }

  /** Second line of a row in reorder mode. */
  reorderMeta(ex: WorkoutExercise): string {
    if (ex.sets?.length) return this.exerciseMeta(ex);
    if (this.targetSets(ex)) return this.planText(ex);
    return this.muscleLabel(ex.muscleGroup);
  }

  // --------------------------------------------------------------- drafts

  draft(exerciseId: number): SetDraft {
    this.draftTick(); // re-read in templates when a draft changes programmatically
    let d = this.drafts.get(exerciseId);
    if (!d) {
      // A bodyweight exercise starts without extra weight.
      const bw = isBodyweight(this.exercises().find((e) => e.id === exerciseId));
      d = {
        reps: DEFAULT_REPS,
        weight: bw ? 0 : DEFAULT_WEIGHT,
        touched: false,
        warmup: false,
      };
      this.drafts.set(exerciseId, d);
    }
    return d;
  }

  /** User typed into a stepper input. */
  setDraft(exerciseId: number, field: 'reps' | 'weight', value: number | null): void {
    const d = this.draft(exerciseId);
    d[field] = value;
    d.touched = true;
    this.draftTick.update((n) => n + 1);
  }

  canLog(exerciseId: number): boolean {
    const d = this.draft(exerciseId);
    return Number(d.reps) >= 1 && d.weight != null && Number(d.weight) >= 0;
  }

  note(exerciseId: number): string {
    return this.noteDrafts.get(exerciseId) ?? '';
  }

  setNote(exerciseId: number, value: string): void {
    this.noteDrafts.set(exerciseId, value);
  }

  toggleWarmup(exerciseId: number): void {
    const d = this.draft(exerciseId);
    d.warmup = !d.warmup;
    this.draftTick.update((n) => n + 1);
  }

  step(ex: number, field: 'reps' | 'weight', delta: number): void {
    const d = this.draft(ex);
    const min = field === 'reps' ? 1 : 0;
    d[field] = Math.max(min, +(Number(d[field] ?? 0) + delta).toFixed(2));
    d.touched = true;
    this.draftTick.update((n) => n + 1);
  }

  /** A scroll over a focused number input must not change its value. */
  blurOnWheel(event: Event): void {
    const el = event.target as HTMLElement | null;
    if (el && el === document.activeElement) el.blur();
  }

  // ---------------------------------------------------------------- notes

  /**
   * Save an exercise's notes if they changed. Emits once saved (or when there
   * was nothing to save) and errors: after showing a toast: when it failed.
   * A blur and a "Finish exercise" tap share the same in-flight request.
   */
  private persistNotes(ex: WorkoutExercise): Observable<void> {
    const text = this.note(ex.id).trim();
    const current = this.exercises().find((e) => e.id === ex.id) ?? ex;
    if (text === (current.notes ?? '')) return of(undefined);
    const pending = this.noteSaves.get(ex.id);
    if (pending && pending.text === text) return pending.obs;
    const obs: Observable<void> = this.exerciseService
      .updateExercise(this.workoutId, ex.id, { notes: text })
      .pipe(
        map(() => undefined),
        tap({
          next: () => {
            // Keep the local model in sync without a full reload.
            ex.notes = text;
            const live = this.exercises().find((e) => e.id === ex.id);
            if (live) live.notes = text;
          },
          error: (err) =>
            this.alerts.error(this.t('toast.notes.err'), this.t(errorHintKey(err))),
        }),
        finalize(() => {
          if (this.noteSaves.get(ex.id)?.obs === obs) this.noteSaves.delete(ex.id);
        }),
        shareReplay(1),
      );
    this.noteSaves.set(ex.id, { text, obs });
    return obs;
  }

  saveNotes(ex: WorkoutExercise): void {
    this.persistNotes(ex).subscribe({ error: () => {} });
  }

  // ------------------------------------------------------------ exercises

  openAddExercise(): void {
    this.showAddExercise.set(true);
  }

  closeAddExercise(): void {
    this.showAddExercise.set(false);
  }

  private nextExerciseOrder(): number {
    return Math.max(0, ...this.exercises().map((e) => Number(e.orderInWorkout) || 0)) + 1;
  }

  private attachExercise(definitionId: number): void {
    this.exerciseService
      .createExercise(this.workoutId, {
        exerciseDefinitionId: definitionId,
        orderInWorkout: this.nextExerciseOrder(),
      })
      .subscribe({
        next: (created) => {
          this.closeAddExercise();
          this.editingSetId.set(null);
          this.activeId.set(created.id);
          this.loadWorkout({
            then: () => {
              this.adding.set(false);
              this.scrollToExercise(created.id);
            },
          });
        },
        error: (err) => {
          this.adding.set(false);
          this.alerts.error(this.t('toast.addExercise.err'), this.t(errorHintKey(err)));
        },
      });
  }

  /** Add a catalog exercise to this workout (always allowed: supersets). */
  addExercise(def: ExerciseDefinition): void {
    if (this.adding()) return;
    this.adding.set(true);
    this.attachExercise(def.id);
  }

  /** Create a brand-new exercise (adds it to the shared catalog) and log it. */
  addNewExercise(input: { name: string; muscleGroup: string; type: ExerciseType }): void {
    const name = input.name.trim();
    const muscleGroup = input.muscleGroup.trim();
    if (!name || !muscleGroup || this.adding()) return;
    this.adding.set(true);
    this.definitionService
      .create({ name, type: input.type ?? ExerciseType.STRENGTH, muscleGroup })
      .subscribe({
        next: (def) => {
          // The server answers with the existing entry for a known name.
          this.definitions.update((list) =>
            list.some((d) => d.id === def.id) ? list : [...list, def],
          );
          this.attachExercise(def.id);
        },
        error: (err) => {
          this.adding.set(false);
          this.alerts.error(this.t('toast.def.add.err'), this.t(errorHintKey(err)));
        },
      });
  }

  /** Removing an exercise with logged sets destroys data: confirm first. */
  deleteExercise(ex: WorkoutExercise): void {
    const total = ex.sets?.length ?? 0;
    if (total === 0) {
      this.removeExercise(ex);
      return;
    }
    const working = workingSets(ex).length;
    const ref = this.modal.open(
      ModalBuilder.confirmation()
        .title(this.t('detail.deleteExercise.title'))
        .message(
          this.t('detail.deleteExercise.confirm', {
            name: ex.name,
            sets: this.setsText(working, total - working, ' + '),
          }),
        )
        .tone(ConfirmationTone.DANGER)
        .confirmAction({ label: this.t('action.delete'), style: ActionStyle.DANGER })
        .cancelAction({ label: this.t('action.cancel') })
        .mobileBottomSheet(true)
        .keyboard(KeyboardMode.ENABLED)
        .build(),
    );
    ref.afterClosed$.subscribe(({ result }) => {
      if (result) this.removeExercise(ex);
    });
  }

  private removeExercise(ex: WorkoutExercise): void {
    if (this.removingExercise) return;
    this.removingExercise = true;
    this.exerciseService.deleteExercise(this.workoutId, ex.id).subscribe({
      next: () => {
        this.removingExercise = false;
        if (this.exercises().length <= 2) this.reordering.set(false);
        const finished = new Set(this.finishedIds());
        finished.delete(ex.id);
        this.finishedIds.set(finished);
        if (this.activeId() === ex.id) this.activeId.set(null);
        if (this.undo()?.exerciseId === ex.id) this.clearUndo();
        this.loadWorkout();
      },
      error: (err) => {
        this.removingExercise = false;
        this.alerts.error(this.t('toast.removeExercise.err'), this.t(errorHintKey(err)));
      },
    });
  }

  // ------------------------------------------------------------------ sets

  addSet(ex: WorkoutExercise): void {
    const d = this.draft(ex.id);
    if (!this.canLog(ex.id) || this.logging()) return;
    const reps = Math.round(Number(d.reps));
    const weight = Number(d.weight);
    const warmup = d.warmup;
    d.reps = reps;

    // Logged from the keyboard (focus in a field)? Then hand focus back after.
    const focused = document.activeElement;
    const fromKeyboard =
      focused instanceof HTMLInputElement &&
      (focused.id === 'reps-' + ex.id || focused.id === 'weight-' + ex.id);

    // Decide on the record toast against what's on screen before the reload.
    const ref = this.refs().get(ex.id);
    const found =
      !warmup && ref
        ? recordKind({ reps, weightKg: weight }, [
            ...ref.earlierSets,
            ...workingSets(ex).map((s) => ({
              reps: Number(s.repsAmount),
              weightKg: Number(s.weightKg),
            })),
          ])
        : null;
    // Only a heavier weight is a record (reps count for bodyweight work).
    const kind = found === 'weight' || isBodyweight(ex) ? found : null;

    this.logging.set(true);
    this.setService
      .createSet(ex.id, {
        setOrder: Math.max(0, ...(ex.sets ?? []).map((s) => s.setOrder)) + 1,
        repsAmount: reps,
        weightKg: weight,
        isWarmup: warmup,
      })
      .subscribe({
        next: (created) => {
          // A warm-up is a one-off: the next set counts again.
          d.warmup = false;
          this.draftTick.update((n) => n + 1);
          this.confirmLogged(ex, created?.setId ?? null, reps, weight, warmup);
          this.loadWorkout({
            then: () => {
              this.logging.set(false);
              // Superset: a working set hands over to the next member.
              const next = warmup ? null : this.rotateSuperset(ex.id);
              if (fromKeyboard) this.focusReps(next ?? ex.id);
            },
          });
          if (kind) {
            this.alerts.success(
              this.t('toast.pr.title'),
              this.t('toast.pr.body', {
                name: ex.name,
                kind: this.t(this.prKey(kind, weight)),
                set: this.setText(reps, weight, isBodyweight(ex)),
              }),
            );
          }
        },
        error: (err) => {
          this.logging.set(false);
          this.alerts.error(this.t('toast.addSet.err'), this.t(errorHintKey(err)));
        },
      });
  }

  /**
   * Quiet confirmation of a logged set: one line under the Log button (the new
   * row itself can land below the tab bar) and a short flash on the row. The
   * button never moves, so the next set stays under the thumb.
   */
  private confirmLogged(
    ex: WorkoutExercise,
    setId: number | null,
    reps: number,
    weight: number,
    warmup: boolean,
  ): void {
    const set = this.setText(reps, weight, isBodyweight(ex));
    const text = warmup
      ? this.t('detail.logged.warmup', { set })
      : this.t('detail.logged', { n: workingSets(ex).length + 1, set });
    this.lastLogged.set({ exerciseId: ex.id, setId, text });
    if (this.loggedTimer) clearTimeout(this.loggedTimer);
    this.loggedTimer = setTimeout(() => this.lastLogged.set(null), LOGGED_MS);
    if (!warmup && this.targetSets(ex) && this.showTargetHint()) {
      this.showTargetHint.set(false);
      try {
        localStorage.setItem(TARGET_HINT_KEY, '1');
      } catch {
        /* storage unavailable: the hint simply shows again next time */
      }
    }
  }

  private focusReps(exerciseId: number): void {
    afterNextRender(
      () => {
        const el = document.getElementById('reps-' + exerciseId) as HTMLInputElement | null;
        el?.focus({ preventScroll: true });
        el?.select();
      },
      { injector: this.injector },
    );
  }

  isDeleting(setId: number): boolean {
    return this.deletingSetIds().has(setId);
  }

  private setDeleting(setId: number, on: boolean): void {
    const next = new Set(this.deletingSetIds());
    on ? next.add(setId) : next.delete(setId);
    this.deletingSetIds.set(next);
  }

  deleteSet(ex: WorkoutExercise, set: ExerciseSet): void {
    if (this.isDeleting(set.setId)) return;
    this.setDeleting(set.setId, true);
    this.setService.deleteSet(ex.id, set.setId).subscribe({
      next: () => {
        if (this.editingSetId() === set.setId) this.editingSetId.set(null);
        this.offerUndo({
          exerciseId: ex.id,
          setOrder: set.setOrder,
          reps: Number(set.repsAmount),
          weightKg: Number(set.weightKg),
          isWarmup: !!set.isWarmup,
        });
        this.loadWorkout({ then: () => this.setDeleting(set.setId, false) });
      },
      error: (err) => {
        this.setDeleting(set.setId, false);
        this.alerts.error(this.t('toast.removeSet.err'), this.t(errorHintKey(err)));
      },
    });
  }

  private offerUndo(state: UndoState): void {
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.undo.set(state);
    this.undoTimer = setTimeout(() => {
      if (!this.restoring()) this.undo.set(null);
    }, UNDO_MS);
  }

  private clearUndo(): void {
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.undoTimer = null;
    this.undo.set(null);
  }

  /** Put the just-deleted set back: same reps, weight, warm-up flag and position. */
  undoDelete(): void {
    const u = this.undo();
    if (!u || this.restoring()) return;
    this.restoring.set(true);
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.setService
      .createSet(u.exerciseId, {
        setOrder: u.setOrder,
        repsAmount: u.reps,
        weightKg: u.weightKg,
        isWarmup: u.isWarmup,
      })
      .subscribe({
        next: () => {
          this.loadWorkout({
            then: () => {
              this.restoring.set(false);
              this.clearUndo();
            },
          });
        },
        error: (err) => {
          this.restoring.set(false);
          // Keep the bar a little longer so it can be tried again.
          this.offerUndo(u);
          this.alerts.error(this.t('toast.undoSet.err'), this.t(errorHintKey(err)));
        },
      });
  }

  startEditSet(set: ExerciseSet): void {
    this.editReps = Number(set.repsAmount);
    this.editWeight = Number(set.weightKg);
    this.editWarmup.set(!!set.isWarmup);
    this.editingSetId.set(set.setId);
  }

  cancelEditSet(): void {
    this.editingSetId.set(null);
  }

  get canSaveSet(): boolean {
    return (
      Number(this.editReps) >= 1 && this.editWeight != null && Number(this.editWeight) >= 0
    );
  }

  saveSet(ex: WorkoutExercise, set: ExerciseSet): void {
    if (!this.canSaveSet || this.savingSet()) return;
    const repsAmount = Math.round(Number(this.editReps));
    const weightKg = Number(this.editWeight);
    const isWarmup = this.editWarmup();
    if (
      repsAmount === Number(set.repsAmount) &&
      weightKg === Number(set.weightKg) &&
      isWarmup === !!set.isWarmup
    ) {
      this.editingSetId.set(null);
      return;
    }
    this.savingSet.set(true);
    this.setService
      .updateSet(ex.id, set.setId, { repsAmount, weightKg, isWarmup })
      .subscribe({
        next: () => {
          this.loadWorkout({
            then: () => {
              this.savingSet.set(false);
              this.editingSetId.set(null);
            },
          });
        },
        error: (err) => {
          this.savingSet.set(false);
          this.alerts.error(this.t('toast.updateSet.err'), this.t(errorHintKey(err)));
        },
      });
  }

  /**
   * Mark the current exercise done and advance to the next. Waits for the
   * notes to be saved: if that fails the exercise stays open, text intact.
   */
  finishExercise(ex: WorkoutExercise): void {
    if ((ex.sets?.length ?? 0) === 0) return; // guarded by the disabled button too
    if (this.finishingExerciseId() != null) return;
    this.finishingExerciseId.set(ex.id);
    this.persistNotes(ex).subscribe({
      next: () => {
        this.finishingExerciseId.set(null);
        this.editingSetId.set(null);
        const finished = new Set(this.finishedIds());
        finished.add(ex.id);
        this.finishedIds.set(finished);

        // Superset: on to the next unfinished member; once all are done, to
        // whatever comes after the superset.
        const list = this.exercises();
        const at = list.findIndex((e) => e.id === ex.id);
        const members = at >= 0 ? supersetMembers(list, at) : [];
        const next =
          this.nextMember(ex.id)?.ex ??
          (members.length > 1
            ? list.find((e, i) => i > members[members.length - 1] && !finished.has(e.id))
            : undefined) ??
          list.find((e) => !finished.has(e.id));
        this.activeId.set(next ? next.id : null);
        if (next) this.scrollToExercise(next.id);
      },
      error: () => this.finishingExerciseId.set(null),
    });
  }

  // --------------------------------------------------------------- workout

  finishWorkout(): void {
    if (!this.canFinish() || this.finishing()) return;
    const total = this.totalSets();
    const plannedText = this.plannedText();
    this.finishing.set(true);
    this.workoutService.finishWorkout(this.workoutId).subscribe({
      next: (w) => {
        this.finishing.set(false);
        this.reordering.set(false);
        this.editingSetId.set(null);
        this.clearUndo();
        this.closeAddExercise();
        this.clearStoredFocus();
        // Keep the tree we already have if the response comes without it.
        const current = this.workout();
        const done = w.exercises ? w : { ...current, ...w, exercises: current?.exercises };
        this.workout.set(done);
        this.expandedIds.set(
          done.exercises?.length ? new Set([done.exercises[0].id]) : new Set(),
        );
        if (this.reopenedToastId) this.alerts.dismiss(this.reopenedToastId);
        this.reopenedToastId = null;
        this.finishedToastId = this.alerts.success(
          this.t('detail.workoutDone.title'),
          this.t(plural(total, 'detail.workoutDone.body'), { n: total }) +
            (plannedText ? ` ${plannedText}.` : ''),
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err) => {
        this.finishing.set(false);
        this.alerts.error(this.t('toast.finish.err'), this.t(errorHintKey(err)));
      },
    });
  }

  /** Unlock a finished workout and drop back into the editable accordion. */
  reopenWorkout(): void {
    if (this.reopening()) return;
    this.reopening.set(true);
    this.workoutService.reopenWorkout(this.workoutId).subscribe({
      next: () => {
        this.reopening.set(false);
        // The workout can change now, so the kept week analysis is out of date.
        this.analysisService.forgetWorkout();
        const current = this.workout();
        if (current) {
          const open: Workout = { ...current, completedAt: null };
          this.workout.set(open);
          this.expandedIds.set(new Set());
          this.initFocus(open);
        }
        // "Workout finished" would now be stale.
        if (this.finishedToastId) this.alerts.dismiss(this.finishedToastId);
        this.finishedToastId = null;
        this.reopenedToastId = this.alerts.success(this.t('toast.reopen.done'));
        this.loadWorkout({ initFocus: !current });
      },
      error: (err) => {
        this.reopening.set(false);
        this.alerts.error(this.t('toast.reopen.err'), this.t(errorHintKey(err)));
      },
    });
  }

  openEdit(): void {
    const w = this.workout();
    if (!w || this.completed()) return;
    this.editName.set(w.name);
    this.editDate.set((w.date ?? '').slice(0, 10));
    this.editNote = w.description ?? '';
    this.showEdit.set(true);
  }

  onEscape(): void {
    if (this.reordering() && !this.showEdit()) this.toggleReorder();
    if (this.showEdit() && !this.savingEdit()) this.showEdit.set(false);
    if (this.showSaveTemplate() && !this.savingTemplate()) this.showSaveTemplate.set(false);
  }

  // ------------------------------------------------------ save as template

  openSaveTemplate(): void {
    const w = this.workout();
    if (!w || !this.completed() || this.totalSets() === 0) return;
    this.templateName.set((w.name ?? '').slice(0, 100));
    this.showSaveTemplate.set(true);
  }

  saveTemplate(): void {
    const name = this.templateName().trim();
    if (!name || this.savingTemplate()) return;
    this.savingTemplate.set(true);
    this.templateService.createFromWorkout(this.workoutId, name).subscribe({
      next: (tpl) => {
        this.savingTemplate.set(false);
        this.showSaveTemplate.set(false);
        this.alerts.success(this.t('toast.saveTemplate.done'), tpl?.name ?? name);
      },
      error: (err) => {
        this.savingTemplate.set(false);
        this.alerts.error(this.t('toast.saveTemplate.err'), this.t(errorHintKey(err)));
      },
    });
  }

  saveEdit(): void {
    const name = this.editName().trim();
    const date = this.editDate();
    if (!name || !date || this.savingEdit()) return;
    const description = this.editNote.trim(); // '' clears the notes
    this.savingEdit.set(true);
    this.workoutService
      .updateWorkout(this.workoutId, { name, date, description })
      .subscribe({
        next: () => {
          this.savingEdit.set(false);
          this.showEdit.set(false);
          // Patch locally: the response may not carry the exercise tree.
          this.workout.update((w) => (w ? { ...w, name, date, description } : w));
        },
        error: (err) => {
          this.savingEdit.set(false);
          this.alerts.error(this.t('toast.updateWorkout.err'), this.t(errorHintKey(err)));
        },
      });
  }

  /** Expand/collapse a finished exercise (in-progress) or a finished-workout row. */
  toggleExpanded(id: number): void {
    const next = new Set(this.expandedIds());
    next.has(id) ? next.delete(id) : next.add(id);
    this.expandedIds.set(next);
  }

  isExpanded(id: number): boolean {
    return this.expandedIds().has(id);
  }

  /** Re-open a finished exercise for logging (only while the workout is live). */
  reopenExercise(ex: WorkoutExercise): void {
    const finished = new Set(this.finishedIds());
    finished.delete(ex.id);
    this.finishedIds.set(finished);
    const expanded = new Set(this.expandedIds());
    expanded.delete(ex.id);
    this.expandedIds.set(expanded);
    this.editingSetId.set(null);
    this.activeId.set(ex.id);
    this.scrollToExercise(ex.id);
  }

  deleteWorkout(): void {
    const w = this.workout();
    if (!w || this.deletingWorkout) return;
    const exCount = this.exercises().length;
    const working = this.totalSets();
    const allSets = this.exercises().reduce((n, e) => n + (e.sets?.length ?? 0), 0);
    const ref = this.modal.open(
      ModalBuilder.confirmation()
        .title(this.t('detail.deleteWorkout.title'))
        .message(
          this.t('detail.deleteWorkout.confirm', {
            name: w.name,
            exercises: `${exCount} ${this.t(plural(exCount, 'unit.exercises'))}`,
            sets: this.setsText(working, allSets - working, ' + '),
          }),
        )
        .tone(ConfirmationTone.DANGER)
        .confirmAction({ label: this.t('action.delete'), style: ActionStyle.DANGER })
        .cancelAction({ label: this.t('action.cancel') })
        .mobileBottomSheet(true)
        .keyboard(KeyboardMode.ENABLED)
        .build(),
    );
    ref.afterClosed$.subscribe(({ result }) => {
      if (!result || this.deletingWorkout) return;
      this.deletingWorkout = true;
      this.workoutService.deleteWorkout(this.workoutId).subscribe({
        next: () => {
          this.clearStoredFocus();
          this.alerts.success(this.t('toast.deleteWorkout.done'));
          this.router.navigate(['/workouts']);
        },
        error: (err) => {
          this.deletingWorkout = false;
          this.alerts.error(
            this.t('toast.deleteWorkout.err'),
            this.t(errorHintKey(err)),
          );
        },
      });
    });
  }

  /** Return to wherever the user came from (home, history, a progress chart). */
  back(): void {
    if (window.history.length > 1) this.location.back();
    else this.router.navigate(['/workouts']);
  }
}
