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
import { supersetLetter } from '../../../shared/superset';
import { TemplateStarter } from '../../data-access/template-starter';
import { TemplateService } from '../../data-access/template.service';
import {
  WorkoutTemplate,
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

  /** "4 templates". */
  headline(): string {
    const n = this.templates().length;
    return this.lang.t(plural(n, 'templates.count'), { n });
  }

  /**
   * The exercises of a template in order, each with its target and its letter
   * when it is part of a superset. Long templates show the first few.
   */
  rowsOf(t: WorkoutTemplate): {
    shown: { id: number | string; name: string; target: string; letter: string | null }[];
    more: number;
  } {
    const list = [...t.exercises].sort((a, b) => a.orderInTemplate - b.orderInTemplate);
    const all = list.map((e, i) => ({
      id: e.id,
      name: e.name,
      target: `${e.targetSets} × ${e.targetReps}`,
      letter: supersetLetter(list, i),
    }));
    const max = 6;
    return all.length > max
      ? { shown: all.slice(0, max - 1), more: all.length - (max - 1) }
      : { shown: all, more: 0 };
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
