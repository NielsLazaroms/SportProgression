import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  ActionStyle,
  ConfirmationTone,
  MnAlertService,
  MnLanguageService,
  MnModalService,
  MnSkeleton,
  MnTranslatePipe,
  ModalBuilder,
} from 'mn-angular-lib';
import { AppHeader } from '../../../layout/app-header';
import { AppIcon } from '../../../shared/app-icon';
import { errorHintKey, plural } from '../../../shared/format';
import { NewWorkoutSheet } from '../../../workouts/components/new-workout-sheet';
import { TemplateService } from '../../data-access/template.service';
import { WorkoutTemplate, templateSetCount } from '../../models/template.model';

/** All templates of the user: start, edit or delete one, or make a new one. */
@Component({
  selector: 'app-templates-page',
  standalone: true,
  imports: [AppHeader, RouterLink, AppIcon, MnSkeleton, MnTranslatePipe, NewWorkoutSheet],
  templateUrl: './templates-page.html',
})
export class TemplatesPage implements OnInit {
  private readonly service = inject(TemplateService);
  private readonly router = inject(Router);
  private readonly alerts = inject(MnAlertService);
  private readonly lang = inject(MnLanguageService);
  private readonly modal = inject(MnModalService);

  readonly templates = signal<WorkoutTemplate[]>([]);
  readonly loading = signal(true);
  /** i18n key explaining why loading failed; null when it worked. */
  readonly loadError = signal<string | null>(null);

  /** Template whose "start" sheet is open. */
  readonly starting = signal<WorkoutTemplate | null>(null);

  // template helpers
  readonly plural = plural;
  readonly setCount = templateSetCount;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.getAll().subscribe({
      next: (list) => {
        this.templates.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(errorHintKey(err));
      },
    });
  }

  /** "Bench Press, Squat, Row" as a preview of what is in the plan. */
  preview(t: WorkoutTemplate): string {
    return t.exercises.map((e) => e.name).join(', ');
  }

  remove(t: WorkoutTemplate): void {
    const ref = this.modal.open(
      ModalBuilder.confirmation()
        .title(this.lang.t('templates.delete.title'))
        .message(this.lang.t('templates.delete.confirm', { name: t.name }))
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
      this.service.delete(t.id).subscribe({
        next: () => {
          this.templates.update((list) => list.filter((x) => x.id !== t.id));
          this.alerts.success(this.lang.t('templates.toast.deleted'));
        },
        error: (err) =>
          this.alerts.error(
            this.lang.t('templates.toast.delete.err'),
            this.lang.t(errorHintKey(err)),
          ),
      });
    });
  }

  back(): void {
    this.router.navigate(['/workouts']);
  }
}
