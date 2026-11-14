import {
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  MnButton,
  MnInputField,
  MnSelect,
  MnBottomSheet,
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
import { AuthService } from '../../../auth/data-access/auth.service';
import { ExerciseDefinitionService } from '../../../exercises/data-access/exercise-definition.service';
import {
  ExerciseDefinition,
  ExerciseType,
} from '../../../exercises/models/exercise.model';
import { MUSCLE_GROUPS } from '../../../shared/muscle-groups';
import { errorHintKey } from '../../../shared/format';

/** Server limit for an exercise name. */
const NAME_MAX = 80;

@Component({
  selector: 'app-exercise-definitions-page',
  standalone: true,
  imports: [
    AppHeader,
    FormsModule,
    AppIcon,
    MnButton,
    MnInputField,
    MnSelect,
    MnBottomSheet,
    MnSkeleton,
    MnTranslatePipe,
  ],
  templateUrl: './exercise-definitions-page.html',
  host: { '(document:keydown.escape)': 'closeForm()' },
})
export class ExerciseDefinitionsPage implements OnInit {
  private readonly service = inject(ExerciseDefinitionService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly alerts = inject(MnAlertService);
  private readonly lang = inject(MnLanguageService);
  private readonly modal = inject(MnModalService);
  private readonly injector = inject(Injector);

  readonly definitions = signal<ExerciseDefinition[]>([]);
  readonly loading = signal(true);
  /** i18n key explaining why loading failed; null when it worked. */
  readonly loadError = signal<string | null>(null);
  readonly query = signal('');

  /** Matches on the name and on the (translated) muscle group. */
  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.definitions();
    return this.definitions().filter((d) =>
      (d.name + ' ' + (d.muscleGroup ?? '') + ' ' + this.muscleLabel(d.muscleGroup))
        .toLowerCase()
        .includes(q),
    );
  });

  // Add / edit sheet. `editing` is the exercise being changed, null when adding.
  readonly showForm = signal(false);
  readonly editing = signal<ExerciseDefinition | null>(null);
  readonly saving = signal(false);
  readonly name = signal('');
  readonly muscleGroup = signal('');

  private readonly formBody = viewChild<ElementRef<HTMLElement>>('formBody');

  get muscleOptions() {
    return MUSCLE_GROUPS.map((m) => ({ label: this.muscleLabel(m), value: m }));
  }

  muscleLabel(value: string | null | undefined): string {
    if (!value) return '';
    return this.lang.translateIfPresent('muscle.' + value) ?? value;
  }


  ngOnInit(): void {
    if (!this.auth.profile()) this.auth.checkAuth().subscribe();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.refresh();
  }

  /** Re-reads the list without flashing the skeleton. */
  private refresh(): void {
    this.service.getAll().subscribe({
      next: (d) => {
        this.definitions.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        if (this.loading()) this.loadError.set(errorHintKey(err));
        this.loading.set(false);
      },
    });
  }

  ownedByMe(def: ExerciseDefinition): boolean {
    return !!def.mine;
  }

  openAdd(): void {
    this.openForm(null);
  }

  openEdit(def: ExerciseDefinition): void {
    this.openForm(def);
  }

  private openForm(def: ExerciseDefinition | null): void {
    this.editing.set(def);
    this.name.set(def?.name ?? '');
    this.muscleGroup.set(def?.muscleGroup ?? '');
    this.showForm.set(true);
    // The kit's input has no maxlength prop: set it on the real <input>, and
    // start with the cursor in the name field.
    afterNextRender(
      () => {
        const input = this.formBody()?.nativeElement.querySelector<HTMLInputElement>('#defname');
        if (!input) return;
        input.maxLength = NAME_MAX;
        input.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  closeForm(): void {
    if (this.saving()) return;
    this.showForm.set(false);
  }

  /** Nothing to save while editing if name and muscle group are unchanged. */
  private unchanged(): boolean {
    const def = this.editing();
    return (
      !!def &&
      def.name === this.name().trim() &&
      (def.muscleGroup ?? '') === this.muscleGroup()
    );
  }

  canSave(): boolean {
    return (
      !!this.name().trim() &&
      !!this.muscleGroup().trim() &&
      !this.saving() &&
      !this.unchanged()
    );
  }

  save(): void {
    if (!this.canSave()) return;
    const name = this.name().trim().slice(0, NAME_MAX);
    const muscleGroup = this.muscleGroup().trim();
    const def = this.editing();
    this.saving.set(true);
    if (def) this.update(def, name, muscleGroup);
    else this.add(name, muscleGroup);
  }

  private add(name: string, muscleGroup: string): void {
    const known = new Set(this.definitions().map((d) => d.id));
    this.service
      .create({ name, type: ExerciseType.STRENGTH, muscleGroup })
      .subscribe({
        next: (created) => {
          this.saving.set(false);
          this.showForm.set(false);
          // The server hands back the existing entry for a name that is taken.
          if (known.has(created.id)) {
            this.alerts.info(
              this.lang.t('toast.def.exists'),
              this.lang.t('toast.def.exists.body', { name: created.name }),
            );
          } else {
            this.alerts.success(this.lang.t('toast.def.added'));
          }
          this.query.set('');
          this.refresh();
        },
        error: (err) => {
          this.saving.set(false);
          this.alerts.error(
            this.lang.t('toast.def.add.err'),
            this.lang.t(errorHintKey(err)),
          );
        },
      });
  }

  private update(def: ExerciseDefinition, name: string, muscleGroup: string): void {
    this.service.update(def.id, { name, muscleGroup }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.alerts.success(this.lang.t('toast.def.updated'));
        this.refresh();
      },
      error: (err) => {
        this.saving.set(false);
        this.alerts.error(
          this.lang.t('toast.def.update.err'),
          err?.status === 409
            ? this.lang.t('toast.def.update.taken', { name })
            : this.lang.t(errorHintKey(err)),
        );
      },
    });
  }

  remove(def: ExerciseDefinition): void {
    const ref = this.modal.open(
      ModalBuilder.confirmation()
        .title(this.lang.t('def.delete.title'))
        .message(this.lang.t('def.delete.confirm', { name: def.name }))
        .tone(ConfirmationTone.DANGER)
        .confirmAction({
          label: this.lang.t('action.delete'),
          style: ActionStyle.DANGER,
        })
        .cancelAction({ label: this.lang.t('action.cancel') })
        .mobileBottomSheet(true)
        .build(),
    );
    ref.afterClosed$.subscribe(({ result }) => {
      if (!result) return;
      this.service.delete(def.id).subscribe({
        next: () => {
          this.alerts.success(this.lang.t('toast.def.deleted'));
          this.refresh();
        },
        error: (err) =>
          this.alerts.error(
            this.lang.t('toast.def.delete.err'),
            this.lang.t(
              err?.status === 409
                ? 'toast.def.delete.inUse'
                : err?.status === 403
                  ? 'toast.def.delete.errBody'
                  : errorHintKey(err),
            ),
          ),
      });
    });
  }

  back(): void {
    this.router.navigate(['/profile']);
  }
}
