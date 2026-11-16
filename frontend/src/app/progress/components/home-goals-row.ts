import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MnLanguageService, MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../../shared/app-icon';
import { plural } from '../../shared/format';
import { GoalService } from '../data-access/goal.service';
import { Goal, MAX_GOALS } from '../models/goal.model';
import { GoalSheet } from './goal-sheet';

/**
 * The way into goals from the home screen: one row that says where you stand
 * and opens Progress, plus a button that adds a goal on the spot.
 */
@Component({
  selector: 'app-home-goals-row',
  standalone: true,
  imports: [RouterLink, AppIcon, MnTranslatePipe, GoalSheet],
  host: { class: 'block' },
  template: `
    <section class="mb-3">
      <div class="glass-card flex min-h-14 items-center rounded-2xl">
        @if (open().length) {
          <a
            routerLink="/progress"
            class="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl py-2.5 pl-4 pr-2 transition-colors active:bg-surface-variant/30"
          >
            <span class="shrink-0 text-primary"><app-icon [data]="{ name: 'target', size: 22 }" /></span>
            <span class="min-w-0 flex-1">
              <span class="block font-bold text-on-surface">{{ 'goals.title' | mnTranslate }}</span>
              <span class="tnum block truncate text-xs text-on-surface-variant">{{ hint() }}</span>
            </span>
          </a>
        } @else {
          <button
            type="button"
            (click)="sheetOpen.set(true)"
            class="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl py-2.5 pl-4 pr-2 text-left transition-colors active:bg-surface-variant/30"
          >
            <span class="shrink-0 text-primary"><app-icon [data]="{ name: 'target', size: 22 }" /></span>
            <span class="min-w-0 flex-1">
              <span class="block font-bold text-on-surface">{{ 'goals.home.empty' | mnTranslate }}</span>
              <span class="block text-xs text-on-surface-variant">{{ 'goals.home.emptyHint' | mnTranslate }}</span>
            </span>
          </button>
        }
        @if (canAdd()) {
          <button
            type="button"
            (click)="sheetOpen.set(true)"
            [attr.aria-label]="'goals.add' | mnTranslate"
            [attr.title]="'goals.add' | mnTranslate"
            class="mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary transition-transform active:scale-95"
          >
            <app-icon [data]="{ name: 'plus', size: 20 }" />
          </button>
        }
      </div>
    </section>

    @if (sheetOpen()) {
      <app-goal-sheet (saved)="onSaved($event)" (closed)="sheetOpen.set(false)" />
    }
  `,
})
export class HomeGoalsRow implements OnInit {
  private readonly service = inject(GoalService);
  private readonly lang = inject(MnLanguageService);

  readonly goals = signal<Goal[]>([]);
  readonly sheetOpen = signal(false);

  /** Goals still to reach (a muscle goal never ends). */
  readonly open = computed(() =>
    this.goals().filter((g) => g.kind === 'muscle' || !g.progress.achieved),
  );
  readonly canAdd = computed(() => this.goals().length < MAX_GOALS);

  ngOnInit(): void {
    this.service.getAll().subscribe({
      next: (list) => this.goals.set(list),
      // Without goals the row still offers to set one.
      error: () => undefined,
    });
  }

  onSaved(list: Goal[]): void {
    this.goals.set(list);
    this.sheetOpen.set(false);
  }

  /** "2 goals, closest: Bench Press 66%" (a plain method: follows a language switch). */
  hint(): string {
    const open = this.open();
    const count = this.lang.t(plural(open.length, 'goals.home.count'), { n: open.length });
    const lifts = open.filter((g) => g.kind === 'lift');
    if (!lifts.length) return count;
    const closest = lifts.reduce((a, b) => (b.progress.pct > a.progress.pct ? b : a));
    return `${count}, ${this.lang.t('goals.home.closest', { name: closest.exerciseName, pct: closest.progress.pct })}`;
  }
}
