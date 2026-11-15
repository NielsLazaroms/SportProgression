import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MnAlertService, MnLanguageService } from 'mn-angular-lib';
import { errorHintKey } from '../../shared/format';
import { WorkoutTemplate } from '../models/template.model';
import { TemplateService } from './template.service';

/**
 * One-tap start: creates today's workout from a template (its name, its
 * exercises and targets) and opens the logging screen, without a form in
 * between. Name, date and notes can be changed on the workout afterwards.
 */
@Injectable({ providedIn: 'root' })
export class TemplateStarter {
  private readonly templates = inject(TemplateService);
  private readonly router = inject(Router);
  private readonly alerts = inject(MnAlertService);
  private readonly lang = inject(MnLanguageService);

  /** Id of the template being started, so its button can show progress and a second tap does nothing. */
  readonly startingId = signal<string | null>(null);

  start(template: WorkoutTemplate): void {
    if (this.startingId()) return;
    this.startingId.set(template.id);
    this.templates.start(template.id).subscribe({
      next: (workout) => {
        void this.router.navigate(['/workouts', workout.id]).finally(() => this.startingId.set(null));
      },
      error: (err) => {
        this.startingId.set(null);
        this.alerts.error(
          this.lang.t('templates.toast.start.err'),
          this.lang.t(err?.status === 404 ? 'templates.toast.gone' : errorHintKey(err)),
        );
      },
    });
  }
}
