import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
})
export class ExerciseDefinitionsPage implements OnInit {
  private readonly service = inject(ExerciseDefinitionService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly alerts = inject(MnAlertService);
  private readonly lang = inject(MnLanguageService);
  private readonly modal = inject(MnModalService);

  readonly definitions = signal<ExerciseDefinition[]>([]);
  readonly loading = signal(true);
  readonly showAdd = signal(false);
  readonly saving = signal(false);

  name = '';
  muscleGroup = '';

  get muscleOptions() {
    return MUSCLE_GROUPS.map((m) => ({ label: this.muscleLabel(m), value: m }));
  }

  muscleLabel(value: string | null | undefined): string {
    if (!value) return '';
    return this.lang.translateIfPresent('muscle.' + value) ?? value;
  }

  private readonly myId = computed(() => this.auth.profile()?.id);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.service.getAll().subscribe({
      next: (d) => {
        this.definitions.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.alerts.error(
          this.lang.t('toast.load.err.title'),
          this.lang.t('toast.retry'),
        );
      },
    });
  }

  ownedByMe(def: ExerciseDefinition): boolean {
    return !!def.createdByUserId && def.createdByUserId === this.myId();
  }

  openAdd(): void {
    this.name = '';
    this.muscleGroup = '';
    this.showAdd.set(true);
  }

  add(): void {
    if (!this.name.trim() || !this.muscleGroup.trim() || this.saving()) return;
    this.saving.set(true);
    this.service
      .create({
        name: this.name.trim(),
        type: ExerciseType.STRENGTH,
        muscleGroup: this.muscleGroup.trim(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showAdd.set(false);
          this.alerts.success(this.lang.t('toast.def.added'));
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.alerts.error(
            this.lang.t('toast.def.add.err'),
            this.lang.t('toast.retry'),
          );
        },
      });
  }

  remove(def: ExerciseDefinition): void {
    const ref = this.modal.open(
      ModalBuilder.confirmation()
        .title(this.lang.t('def.delete.title'))
        .message(this.lang.t('def.delete.confirm'))
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
        next: () => this.load(),
        error: () =>
          this.alerts.error(
            this.lang.t('toast.def.delete.err'),
            this.lang.t('toast.def.delete.errBody'),
          ),
      });
    });
  }

  back(): void {
    this.router.navigate(['/profile']);
  }
}
