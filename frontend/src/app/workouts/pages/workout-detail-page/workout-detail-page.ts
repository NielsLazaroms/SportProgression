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
} from 'mn-angular-lib';
import { AppIcon } from '../../../shared/app-icon';
import { AppHeader } from '../../../layout/app-header';
import { WorkoutService } from '../../data-access/workout.service';
import { ExerciseService } from '../../../exercises/data-access/exercise.service';
import { ExerciseDefinitionService } from '../../../exercises/data-access/exercise-definition.service';
import { SetService } from '../../../exercises/data-access/set.service';
import { ProgressService } from '../../../progress/data-access/progress.service';
import {
  ExerciseHistory,
  ExerciseSession,
  RecordKind,
  recordKind,
} from '../../../progress/models/progress.model';
import {
  Workout,
  workoutVolumeKg,
  workoutSetCount,
  workingSets,
} from '../../models/workout.model';
import {
  ExerciseDefinition,
  ExerciseSet,
  ExerciseType,
  WorkoutExercise,
} from '../../../exercises/models/exercise.model';
import {
  compactKg,
  errorHintKey,
  formatNumber,
  plural,
  relativeDay,
} from '../../../shared/format';
import { ExercisePicker } from '../../components/exercise-picker/exercise-picker';

interface SetDraft {
  /** null while the input is cleared mid-typing. */
  reps: number | null;
  weight: number | null;
  /** True once the user changed a value — never prefill over it. */
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
const APP_TITLE = 'Iron Pulse';

type ExState = 'finished' | 'active' | 'pending';

@Component({
  selector: 'app-workout-detail-page',
  standalone: true,
  imports: [
    AppHeader,
    FormsModule,
    NgTemplateOutlet,
    AppIcon,
    ExercisePicker,
    MnBottomSheet,
    MnButton,
    MnInputField,
    MnSkeleton,
    MnTranslatePipe,
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
  private readonly exerciseService = inject(ExerciseService);
  private readonly definitionService = inject(ExerciseDefinitionService);
  private readonly setService = inject(SetService);
  private readonly progressService = inject(ProgressService);
  private readonly alerts = inject(MnAlertService);
  private readonly lang = inject(MnLanguageService);
  private readonly modal = inject(MnModalService);

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

  /** Catalog ids already in this workout — flagged in the picker. */
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
      for (const s of prev) {
        for (const set of s.sets) {
          const p = { reps: Number(set.reps), weightKg: Number(set.weightKg) };
          if (!(p.reps > 0)) continue;
          earlierSets.push(p);
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
        earlierSets,
      });
    }
    return out;
  });

  /**
   * Working sets of this workout that are a personal record, with the kind:
   * heavier than ever ('weight') or more reps than ever at that weight or
   * heavier ('reps') — compared with every earlier finished session plus the
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
        if (kind) out.set(set.setId, kind);
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
  }

  // ---------------------------------------------------------------- loading

  private loadWorkout(opts: { initFocus?: boolean; then?: () => void } = {}): void {
    this.workoutService.getWorkout(this.workoutId).subscribe({
      next: (w) => {
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
   * continue from the last set logged today, else 10 × 20.
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

  /** "67,5 kg", or the bodyweight label for 0 kg. */
  weightText(kg: number | string): string {
    return Number(kg) === 0
      ? this.t('unit.bw')
      : `${this.num(kg)} ${this.t('unit.kg')}`;
  }

  /** "9 × 67,5 kg" / "12 × BW". */
  setText(reps: number | string, kg: number | string): string {
    return `${this.num(reps)} × ${this.weightText(kg)}`;
  }

  /** Compact chip text without the unit: "9 × 67,5" / "12 × BW". */
  chipText(reps: number | string, kg: number | string): string {
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

  /** Row summary: "3 sets · 1 warm-up · 1.8k kg". */
  exerciseMeta(ex: WorkoutExercise): string {
    const working = workingSets(ex).length;
    const parts = [this.setsText(working, (ex.sets?.length ?? 0) - working, ' · ')];
    const vol = this.exerciseVolume(ex);
    if (vol > 0) parts.push(`${compactKg(vol, this.lang.locale)} ${this.t('unit.kg')}`);
    return parts.join(' · ');
  }

  volumeText(): string {
    return compactKg(this.volume(), this.lang.locale);
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
      d.reps = Number(target.reps);
      d.weight = Number(target.weightKg);
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

  // --------------------------------------------------------------- drafts

  draft(exerciseId: number): SetDraft {
    this.draftTick(); // re-read in templates when a draft changes programmatically
    let d = this.drafts.get(exerciseId);
    if (!d) {
      d = { reps: DEFAULT_REPS, weight: DEFAULT_WEIGHT, touched: false, warmup: false };
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
   * was nothing to save) and errors — after showing a toast — when it failed.
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
  addNewExercise(input: { name: string; muscleGroup: string }): void {
    const name = input.name.trim();
    const muscleGroup = input.muscleGroup.trim();
    if (!name || !muscleGroup || this.adding()) return;
    this.adding.set(true);
    this.definitionService
      .create({ name, type: ExerciseType.STRENGTH, muscleGroup })
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

  /** Removing an exercise with logged sets destroys data — confirm first. */
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
    const kind =
      !warmup && ref
        ? recordKind({ reps, weightKg: weight }, [
            ...ref.earlierSets,
            ...workingSets(ex).map((s) => ({
              reps: Number(s.repsAmount),
              weightKg: Number(s.weightKg),
            })),
          ])
        : null;

    this.logging.set(true);
    this.setService
      .createSet(ex.id, {
        setOrder: Math.max(0, ...(ex.sets ?? []).map((s) => s.setOrder)) + 1,
        repsAmount: reps,
        weightKg: weight,
        isWarmup: warmup,
      })
      .subscribe({
        next: () => {
          // A warm-up is a one-off: the next set counts again.
          d.warmup = false;
          this.draftTick.update((n) => n + 1);
          this.loadWorkout({
            then: () => {
              this.logging.set(false);
              if (fromKeyboard) this.focusReps(ex.id);
            },
          });
          if (kind) {
            this.alerts.success(
              this.t('toast.pr.title'),
              this.t('toast.pr.body', {
                name: ex.name,
                kind: this.t(this.prKey(kind, weight)),
                set: this.setText(reps, weight),
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

        const next = this.exercises().find((e) => !finished.has(e.id));
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
    this.finishing.set(true);
    this.workoutService.finishWorkout(this.workoutId).subscribe({
      next: (w) => {
        this.finishing.set(false);
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
          this.t(plural(total, 'detail.workoutDone.body'), { n: total }),
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
    if (this.showEdit() && !this.savingEdit()) this.showEdit.set(false);
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
