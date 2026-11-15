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
  KeyboardMode,
  ModalBuilder,
} from 'mn-angular-lib';
import { AppHeader } from '../../../layout/app-header';
import { AppIcon } from '../../../shared/app-icon';
import { errorHintKey, plural } from '../../../shared/format';
import { supersetRuns } from '../../../shared/superset';
import { TemplateStarter } from '../../data-access/template-starter';
import { TemplateService } from '../../data-access/template.service';
import {
  TemplateExercise,
  WorkoutTemplate,
  templateSetCount,
} from '../../models/template.model';

/** All templates of the user: start, edit or delete one, or make a new one. */
@Component({
  selector: 'app-templates-page',
  standalone: true,
  imports: [AppHeader, RouterLink, AppIcon, MnSkeleton, MnTranslatePipe],
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

  /** One-tap start: today's workout from a template, straight to logging. */
  readonly starter = inject(TemplateStarter);

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

  /**
   * What is in the plan, in order: one piece per exercise, and one piece per
   * superset ("Superset: Bench Press + Barbell Row").
   */
  preview(t: WorkoutTemplate): { superset: boolean; text: string }[] {
    const runs = supersetRuns<TemplateExercise>(
      [...t.exercises].sort((a, b) => a.orderInTemplate - b.orderInTemplate),
    );
    return runs.map((run, i) => ({
      superset: run.length > 1,
      text: run.map((e) => e.name).join(' + ') + (i < runs.length - 1 ? ', ' : ''),
    }));
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
        .keyboard(KeyboardMode.ENABLED)
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
