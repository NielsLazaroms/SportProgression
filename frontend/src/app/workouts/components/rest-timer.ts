import { Component, OnDestroy, computed, signal } from '@angular/core';
import { MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../../shared/app-icon';

/** "1:30", "3:00", "0:05": seconds as minutes and seconds. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** How long "Rest over" stays on screen before the pill goes away. */
const DONE_MS = 6000;
/** What the + button adds to a running rest, in seconds. */
const EXTRA_S = 30;

/**
 * Rest countdown after a logged set: a small pill above the tab bar, so it
 * stays in view while you scroll to the next exercise. It counts from an end
 * time (not from ticks), so it stays right when the phone locks or the tab
 * sleeps. At zero it buzzes (where the phone allows) and beeps once.
 * Only shown when the user turned the rest timer on in Settings.
 */
@Component({
  selector: 'app-rest-timer',
  standalone: true,
  imports: [AppIcon, MnTranslatePipe],
  template: `
    @if (state() !== 'idle') {
      @let done = state() === 'done';
      <!-- Room to scroll the last buttons on the page clear of the pill -->
      <div class="h-20 lg:h-16" aria-hidden="true"></div>
      <div
        role="timer"
        [attr.aria-label]="'rest.aria' | mnTranslate"
        class="fixed inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5rem)] z-40 mx-auto max-w-md overflow-hidden rounded-2xl border shadow-[0_10px_30px_rgb(0_0_0/0.35)] backdrop-blur-xl lg:bottom-6 lg:left-60 lg:right-0 lg:w-[calc(100%-17rem)]"
        [class]="done ? 'border-success/40 bg-[color-mix(in_srgb,var(--color-success)_18%,var(--color-surface-container-high))]' : 'border-outline-variant/25 bg-surface-container-high/90'"
      >
        <div class="flex items-center gap-3 py-1.5 pl-4 pr-1.5">
          <span class="shrink-0" [class]="done ? 'text-success' : 'text-primary'">
            <app-icon [data]="{ name: done ? 'check' : 'timer', size: 20 }" />
          </span>
          @if (done) {
            <span class="min-w-0 flex-1 font-bold text-on-surface" role="status">{{ 'rest.done' | mnTranslate }}</span>
          } @else {
            <span class="min-w-0 flex-1">
              <span class="block text-xs font-semibold text-on-surface-variant">{{ 'rest.label' | mnTranslate }}</span>
              <span class="tnum block font-display text-2xl font-extrabold leading-tight text-on-surface" aria-hidden="true">{{ clock() }}</span>
            </span>
            <button
              type="button"
              (click)="add(extra)"
              [attr.aria-label]="'rest.aria.add' | mnTranslate: { n: extra }"
              class="tnum flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-3 text-sm font-bold text-primary transition-colors hover:bg-primary-container/15"
            >
              <app-icon [data]="{ name: 'plus', size: 16 }" />{{ extra }} s
            </button>
          }
          <button
            type="button"
            (click)="stop()"
            [attr.aria-label]="(done ? 'rest.aria.close' : 'rest.aria.skip') | mnTranslate"
            class="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-variant/40"
          >
            <app-icon [data]="{ name: 'x', size: 18 }" />
          </button>
        </div>
        @if (!done) {
          <!-- How much rest is left, as a thin bar along the bottom -->
          <div class="h-1 bg-surface-container-highest" aria-hidden="true">
            <div class="h-full bg-primary transition-[width] duration-300 ease-linear" [style.width.%]="left() * 100"></div>
          </div>
        }
      </div>
    }
  `,
})
export class RestTimer implements OnDestroy {
  readonly extra = EXTRA_S;

  private readonly endsAt = signal<number | null>(null);
  private readonly total = signal(0);
  private readonly now = signal(Date.now());
  readonly state = signal<'idle' | 'running' | 'done'>('idle');

  private tick: ReturnType<typeof setInterval> | null = null;
  private doneTimer: ReturnType<typeof setTimeout> | null = null;
  private audio: AudioContext | null = null;

  private readonly remaining = computed(() => {
    const end = this.endsAt();
    return end == null ? 0 : Math.max(0, (end - this.now()) / 1000);
  });
  readonly clock = computed(() => formatClock(this.remaining()));
  /** Share of the rest still to go, 1 at the start and 0 at the end. */
  readonly left = computed(() => (this.total() ? this.remaining() / this.total() : 0));

  /** Starts (or restarts) the countdown; a new set always resets it. */
  start(seconds: number): void {
    if (seconds <= 0) return;
    this.clearTimers();
    this.prepareSound();
    this.now.set(Date.now());
    this.endsAt.set(Date.now() + seconds * 1000);
    this.total.set(seconds);
    this.state.set('running');
    this.tick = setInterval(() => this.onTick(), 250);
  }

  add(seconds: number): void {
    const end = this.endsAt();
    if (end == null || this.state() !== 'running') return;
    this.endsAt.set(end + seconds * 1000);
    // The bar stays honest: the extra time counts toward the whole rest.
    this.total.update((t) => Math.max(t + seconds, this.remaining()));
  }

  stop(): void {
    this.clearTimers();
    this.endsAt.set(null);
    this.state.set('idle');
  }

  ngOnDestroy(): void {
    this.clearTimers();
    void this.audio?.close();
  }

  private onTick(): void {
    this.now.set(Date.now());
    if (this.remaining() > 0) return;
    this.clearTimers();
    this.state.set('done');
    this.alert();
    this.doneTimer = setTimeout(() => this.stop(), DONE_MS);
  }

  private clearTimers(): void {
    if (this.tick) clearInterval(this.tick);
    if (this.doneTimer) clearTimeout(this.doneTimer);
    this.tick = null;
    this.doneTimer = null;
  }

  /** Made right after a tap on Log, so the browser lets it play later. */
  private prepareSound(): void {
    try {
      this.audio ??= new AudioContext();
      void this.audio.resume();
    } catch {
      /* no Web Audio: the buzz and the screen still say rest is over */
    }
  }

  private alert(): void {
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      /* vibration not allowed here */
    }
    const ctx = this.audio;
    if (!ctx || ctx.state !== 'running') return;
    // Two short beeps.
    for (const offset of [0, 0.25]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      const t = ctx.currentTime + offset;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    }
  }
}
