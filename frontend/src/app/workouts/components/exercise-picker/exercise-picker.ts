import {
  AfterViewInit,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MnButton, MnLanguageService, MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../../../shared/app-icon';
import {
  ExerciseDefinition,
  ExerciseType,
  isBodyweight,
} from '../../../exercises/models/exercise.model';
import { BodyweightTag, ExerciseTypeToggle } from '../../../shared/bodyweight';
import { MUSCLE_GROUPS } from '../../../shared/muscle-groups';

/** Lower-case and strip accents so "pull up" finds "Pull-Up" / "Crunch (é)". */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Searchable exercise picker for the workout logging screen: type to filter
 * the catalog (by name or muscle group), tap a result to add it straight away,
 * or create an exercise that is not in the list yet. Nothing is preselected.
 */
@Component({
  selector: 'app-exercise-picker',
  standalone: true,
  imports: [FormsModule, AppIcon, MnButton, MnTranslatePipe, BodyweightTag, ExerciseTypeToggle],
  templateUrl: './exercise-picker.html',
  host: { class: 'block scroll-mt-20' },
})
export class ExercisePicker implements AfterViewInit {
  private readonly lang = inject(MnLanguageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The shared exercise catalog. */
  readonly definitions = input.required<ExerciseDefinition[]>();
  /** Catalog ids that are already part of this workout (flagged, still allowed). */
  readonly usedIds = input<Set<number>>(new Set());
  /** True while the parent is adding/creating — blocks repeat taps. */
  readonly busy = input(false);
  /** i18n key of the marker on entries that are already in the list. */
  readonly usedLabel = input('picker.inWorkout');

  readonly pick = output<ExerciseDefinition>();
  readonly create = output<{ name: string; muscleGroup: string; type: ExerciseType }>();
  readonly closed = output<void>();

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('search');
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('newNameInput');

  readonly query = signal('');
  readonly creating = signal(false);
  readonly newName = signal('');
  readonly newMuscle = signal('');
  /** Weights (default) or bodyweight. */
  readonly newType = signal<ExerciseType>(ExerciseType.STRENGTH);
  readonly isBodyweight = isBodyweight;
  /** Id of the row that was tapped, to show "Adding…" on that row only. */
  readonly pickedId = signal<number | null>(null);

  readonly muscles = MUSCLE_GROUPS;

  /** Translated muscle-group label, falling back to the raw stored value. */
  muscleLabel(value: string | null | undefined): string {
    if (!value) return '';
    return this.lang.translateIfPresent('muscle.' + value) ?? value;
  }

  readonly results = computed(() => {
    const q = normalize(this.query());
    const rows = this.definitions().map((d) => ({
      def: d,
      name: normalize(d.name),
      muscle: normalize(this.muscleLabel(d.muscleGroup) + ' ' + (d.muscleGroup ?? '')),
    }));
    const hits = q
      ? rows.filter((r) => r.name.includes(q) || r.muscle.includes(q))
      : rows;
    // Names that start with the query first, then alphabetical.
    return hits
      .sort((a, b) => {
        const sa = q && a.name.startsWith(q) ? 0 : 1;
        const sb = q && b.name.startsWith(q) ? 0 : 1;
        return sa - sb || a.def.name.localeCompare(b.def.name);
      })
      .map((r) => r.def);
  });

  /** Why "Add" is disabled in the create form, or null when it is allowed. */
  readonly createBlock = computed<string | null>(() => {
    if (!this.newName().trim()) return 'picker.create.needName';
    if (!this.newMuscle()) return 'picker.create.needMuscle';
    return null;
  });

  ngAfterViewInit(): void {
    // Bring the panel into view (it opens below the fold) and start typing.
    requestAnimationFrame(() => {
      this.host.nativeElement.scrollIntoView({ block: 'start', behavior: 'smooth' });
      this.searchInput()?.nativeElement.focus({ preventScroll: true });
    });
  }

  choose(def: ExerciseDefinition): void {
    if (this.busy()) return;
    this.pickedId.set(def.id);
    this.pick.emit(def);
  }

  /** Enter in the search field adds the top result. */
  chooseFirst(): void {
    const first = this.results()[0];
    if (first) this.choose(first);
  }

  startCreate(): void {
    this.newName.set(this.query().trim());
    this.newMuscle.set('');
    this.newType.set(ExerciseType.STRENGTH);
    this.creating.set(true);
    requestAnimationFrame(() => {
      const el = this.nameInput()?.nativeElement;
      // Name already filled from the search: don't pop the keyboard again.
      if (el && !el.value) el.focus({ preventScroll: true });
    });
  }

  backToSearch(): void {
    this.creating.set(false);
    requestAnimationFrame(() =>
      this.searchInput()?.nativeElement.focus({ preventScroll: true }),
    );
  }

  submitCreate(): void {
    if (this.createBlock() || this.busy()) return;
    this.create.emit({
      name: this.newName().trim(),
      muscleGroup: this.newMuscle(),
      type: this.newType(),
    });
  }
}
