import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MnAlertService, MnLanguageService, MnSkeleton, MnTranslatePipe } from 'mn-angular-lib';
import { AppHeader } from '../layout/app-header';
import { AppIcon } from '../shared/app-icon';
import { errorHintKey } from '../shared/format';
import { AnalysisService, GymEquipmentItem, MyGym } from '../analysis/analysis.service';

type Group = GymEquipmentItem['group'];
const GROUPS: Group[] = ['free_weights', 'stations', 'legs', 'upper', 'other'];
const NAME_MAX = 60;
const MACHINE_MAX = 40;

/**
 * "My gym": what the user's gym has, so Bolt only plans exercises that can be
 * done there. Grouped tiles that save on every tap, plus an optional name.
 */
@Component({
  selector: 'app-my-gym-page',
  standalone: true,
  imports: [AppHeader, AppIcon, MnSkeleton, MnTranslatePipe],
  template: `
    <app-header [title]="'gym.title' | mnTranslate" (back)="back()" />

    <main class="mx-auto max-w-2xl px-4 pb-28 pt-20">
      @if (!loaded()) {
        <div class="space-y-2">
          @for (i of [1, 2, 3]; track i) {
            <mn-skeleton [data]="{ shape: 'rectangle', height: '96px' }" class="rounded-2xl" />
          }
        </div>
      } @else {
        <section class="mb-6">
          <label for="gym-name" class="mb-2 block px-1 text-sm font-semibold text-on-surface-variant">
            {{ 'gym.name' | mnTranslate }}
          </label>
          <input
            id="gym-name"
            type="text"
            [attr.maxlength]="nameMax"
            [value]="name()"
            (input)="name.set($any($event.target).value)"
            (blur)="saveName()"
            (keydown.enter)="$any($event.target).blur()"
            [placeholder]="'gym.name.ph' | mnTranslate"
            class="glass-card min-h-12 w-full rounded-2xl px-4 text-base text-on-surface outline-none placeholder:text-outline focus:ring-2 focus:ring-primary"
          />
          <p class="mt-2 px-1 text-sm text-on-surface-variant">
            {{ (ownedCount() ? 'gym.intro' : 'gym.intro.empty') | mnTranslate }}
          </p>
        </section>

        @for (g of groups; track g) {
          @let list = itemsIn(g);
          @if (g !== 'other' || list.length) {
            <section class="mb-6">
              <div class="mb-2 flex items-center justify-between gap-2 px-1">
                <h2 [id]="'gym-' + g" class="text-sm font-semibold text-on-surface-variant">
                  {{ 'gym.group.' + g | mnTranslate }}
                  @if (g !== 'other') {
                    <span class="ml-1 font-normal text-outline">{{ ownedIn(g) }}/{{ list.length }}</span>
                  }
                </h2>
                @if (g !== 'other') {
                  <button
                    type="button"
                    (click)="setGroup(g, ownedIn(g) < list.length)"
                    class="min-h-9 rounded-lg px-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    {{ (ownedIn(g) < list.length ? 'gym.all' : 'gym.none') | mnTranslate }}
                  </button>
                }
              </div>
              <div
                role="group"
                [attr.aria-labelledby]="'gym-' + g"
                [attr.aria-busy]="saving()"
                class="grid grid-cols-2 gap-1.5 min-[380px]:grid-cols-3 sm:grid-cols-4"
              >
                @for (item of list; track item.name) {
                  <button
                    type="button"
                    (click)="toggle(item.name)"
                    [attr.aria-pressed]="item.custom ? null : item.owned"
                    [attr.aria-label]="item.custom ? ('profile.equipment.remove' | mnTranslate: { name: item.name }) : null"
                    class="flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl px-2 py-1 text-sm font-semibold leading-tight transition-colors"
                    [class]="item.owned ? 'bg-primary/15 text-primary' : 'glass-card text-on-surface-variant'"
                  >
                    @if (item.custom) {
                      <app-icon [data]="{ name: 'x', size: 14 }" />
                    } @else if (item.owned) {
                      <app-icon [data]="{ name: 'check', size: 14 }" />
                    }
                    <span class="min-w-0 text-center">{{ label(item) }}</span>
                  </button>
                }
              </div>
            </section>
          }
        }

        <section class="mb-6">
          <label for="gym-add" class="mb-2 block px-1 text-sm font-semibold text-on-surface-variant">
            {{ 'gym.add' | mnTranslate }}
          </label>
          <form class="flex gap-1.5" (submit)="$event.preventDefault(); addMachine()">
            <input
              id="gym-add"
              type="text"
              [attr.maxlength]="machineMax"
              [value]="newMachine()"
              (input)="newMachine.set($any($event.target).value)"
              [placeholder]="'profile.equipment.add.ph' | mnTranslate"
              class="glass-card min-h-11 min-w-0 flex-1 rounded-xl px-3 text-base text-on-surface outline-none placeholder:text-outline focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              [disabled]="!newMachine().trim()"
              class="flex min-h-11 shrink-0 items-center gap-1 rounded-xl bg-primary px-3 text-sm font-bold text-on-primary-container disabled:opacity-50"
            >
              <app-icon [data]="{ name: 'plus', size: 16 }" />
              {{ 'profile.equipment.add' | mnTranslate }}
            </button>
          </form>
          <p class="mt-2 px-1 text-xs text-on-surface-variant">{{ 'gym.catalogHint' | mnTranslate }}</p>
        </section>
        <p class="sr-only" role="status" aria-live="polite">{{ announcement() }}</p>
      }
    </main>
  `,
})
export class MyGymPage implements OnInit {
  private readonly analysis = inject(AnalysisService);
  private readonly lang = inject(MnLanguageService);
  private readonly alerts = inject(MnAlertService);
  private readonly router = inject(Router);

  readonly groups = GROUPS;
  readonly nameMax = NAME_MAX;
  readonly machineMax = MACHINE_MAX;

  readonly loaded = signal(false);
  readonly name = signal('');
  readonly items = signal<GymEquipmentItem[]>([]);
  readonly newMachine = signal('');
  readonly saving = signal(false);
  readonly announcement = signal('');
  readonly ownedCount = computed(() => this.items().filter((i) => i.owned).length);

  /** A change made while a save is running: sent right after it. */
  private dirty = false;
  /** What the server last confirmed, to fall back on when a save fails. */
  private confirmed: MyGym | null = null;

  ngOnInit(): void {
    this.analysis.myGym().subscribe({
      next: (gym) => this.apply(gym),
      error: (err) =>
        this.alerts.error(this.lang.t('profile.equipment.err'), this.lang.t(errorHintKey(err))),
    });
  }

  back(): void {
    this.router.navigate(['/profile']);
  }

  itemsIn(group: Group): GymEquipmentItem[] {
    return this.items().filter((i) => i.group === group);
  }

  ownedIn(group: Group): number {
    return this.itemsIn(group).filter((i) => i.owned).length;
  }

  label(item: GymEquipmentItem): string {
    return item.custom ? item.name : (this.lang.translateIfPresent('equipment.' + item.name) ?? item.name);
  }

  /** A standard item switches on or off; a machine the user added is removed. */
  toggle(name: string): void {
    const item = this.items().find((i) => i.name === name);
    if (!item) return;
    this.items.update((list) =>
      item.custom
        ? list.filter((i) => i !== item)
        : list.map((i) => (i === item ? { ...i, owned: !i.owned } : i)),
    );
    this.announcement.set(
      this.lang.t(item.owned ? 'profile.equipment.off' : 'profile.equipment.on', { name: this.label(item) }),
    );
    this.save();
  }

  /** Ticks or clears a whole group at once. */
  setGroup(group: Group, owned: boolean): void {
    this.items.update((list) => list.map((i) => (i.group === group ? { ...i, owned } : i)));
    this.announcement.set(
      this.lang.t(owned ? 'gym.group.on' : 'gym.group.off', { name: this.lang.t('gym.group.' + group) }),
    );
    this.save();
  }

  addMachine(): void {
    const name = this.newMachine().trim().replace(/\s+/g, ' ').slice(0, MACHINE_MAX);
    this.newMachine.set('');
    if (!name) return;
    const lower = name.toLowerCase();
    const same = this.items().find(
      (i) => i.name.toLowerCase() === lower || this.label(i).toLowerCase() === lower,
    );
    if (same) {
      if (!same.owned) this.toggle(same.name);
      return;
    }
    this.items.update((list) => [...list, { name, group: 'other', owned: true, custom: true }]);
    this.announcement.set(this.lang.t('profile.equipment.on', { name }));
    this.save();
  }

  saveName(): void {
    const name = this.name().trim().slice(0, NAME_MAX);
    this.name.set(name);
    if (name === (this.confirmed?.name ?? '')) return;
    this.save();
  }

  private apply(gym: MyGym): void {
    this.confirmed = gym;
    this.items.set(gym.items);
    if (!this.loaded() || document.activeElement?.id !== 'gym-name') this.name.set(gym.name);
    this.loaded.set(true);
  }

  /** One save at a time; the latest state always wins. */
  private save(): void {
    if (this.saving()) {
      this.dirty = true;
      return;
    }
    this.saving.set(true);
    this.analysis
      .setMyGym({
        name: this.name().trim().slice(0, NAME_MAX),
        equipment: this.items().filter((i) => i.owned).map((i) => i.name),
      })
      .subscribe({
        next: (gym) => {
          this.saving.set(false);
          if (this.dirty) {
            this.dirty = false;
            this.confirmed = gym;
            this.save();
            return;
          }
          this.apply(gym);
        },
        error: (err) => {
          this.saving.set(false);
          this.dirty = false;
          if (this.confirmed) this.apply(this.confirmed);
          this.announcement.set('');
          this.alerts.error(this.lang.t('profile.equipment.err'), this.lang.t(errorHintKey(err)));
        },
      });
  }
}
