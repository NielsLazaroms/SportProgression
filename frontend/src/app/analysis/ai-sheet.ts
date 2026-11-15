import {
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MnBottomSheet, MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../shared/app-icon';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let nextId = 0;

/**
 * The shell of the AI sheets (analysis and plan): a bottom sheet on phones and
 * tablets, a centred dialog next to the sidebar from `lg` up. It owns what a
 * dialog needs: the title, the close button, Escape, focus (into the sheet on
 * open, kept inside while open, back to the opener on close) and a polite
 * live text for results that arrive later.
 *
 *   <app-ai-sheet [title]="..." [announce]="..." (closed)="closed.emit()"> ... </app-ai-sheet>
 */
@Component({
  selector: 'app-ai-sheet',
  standalone: true,
  imports: [AppIcon, MnBottomSheet, MnTranslatePipe],
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <mn-bottom-sheet
      [maxHeightVh]="90"
      [ariaLabelledby]="headingId"
      [showGrabber]="!desktop()"
      [containerClass]="containerClass()"
      (dismiss)="closed.emit()"
    >
      <div
        #panel
        class="mx-auto max-h-[80dvh] w-full max-w-xl overflow-y-auto overscroll-contain px-5 pb-6 pt-2 lg:max-w-none lg:px-6 lg:pt-5"
      >
        <div class="mb-4 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2
              #heading
              [id]="headingId"
              tabindex="-1"
              class="flex items-center gap-2 font-display text-xl font-bold text-on-surface outline-none"
            >
              <span class="shrink-0 text-primary"><app-icon [data]="{ name: 'sparkles', size: 20 }" /></span>
              <span class="min-w-0 break-words">{{ title() }}</span>
            </h2>
            @if (subtitle(); as sub) {
              <p class="mt-0.5 text-sm text-on-surface-variant">{{ sub }}</p>
            }
          </div>
          <button
            type="button"
            (click)="closed.emit()"
            [attr.aria-label]="'action.close' | mnTranslate"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-variant/50"
          >
            <app-icon [data]="{ name: 'x', size: 22 }" />
          </button>
        </div>

        <p class="sr-only" role="status" aria-live="polite">{{ announce() }}</p>

        <ng-content />
      </div>
    </mn-bottom-sheet>
  `,
})
export class AiSheet implements OnDestroy {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  /** Text for screen readers when the state changes ("Analysis ready"). */
  readonly announce = input('');
  /** A wider dialog on desktop, for a weekly plan shown as a grid of days. */
  readonly wide = input(false);
  readonly closed = output<void>();

  readonly headingId = `ai-sheet-title-${nextId++}`;

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  /** The control that had focus when the sheet opened: focus goes back there. */
  private readonly opener = typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null);

  private readonly media = typeof matchMedia === 'function' ? matchMedia('(min-width: 1024px)') : null;
  readonly desktop = signal(this.media?.matches ?? false);
  private readonly onMedia = (e: MediaQueryListEvent) => this.desktop.set(e.matches);

  /** From `lg` up: a rounded dialog centred in the area right of the 15rem sidebar. */
  readonly containerClass = computed(
    () =>
      'lg:left-60 lg:right-0 lg:top-0 lg:bottom-0 lg:m-auto lg:h-fit lg:w-[calc(100%-17rem)] lg:rounded-2xl lg:border ' +
      (this.wide() ? 'lg:max-w-4xl' : 'lg:max-w-2xl'),
  );

  private readonly injector = inject(Injector);

  constructor() {
    this.media?.addEventListener('change', this.onMedia);
    afterNextRender(() => this.focusTitle());
    // A new state replaces the content: when that removed the focused control
    // (a pressed "Try again"), focus would fall back to <body>. Keep it here.
    effect(() => {
      this.announce();
      afterNextRender(
        () => {
          const panel = this.panel()?.nativeElement;
          if (panel && !panel.contains(document.activeElement)) this.focusTitle();
        },
        { injector: this.injector },
      );
    });
  }

  ngOnDestroy(): void {
    this.media?.removeEventListener('change', this.onMedia);
    const opener = this.opener;
    // After the sheet has left the page, and only when the opener still exists
    // (it does not after "Start workout" moved to another page).
    setTimeout(() => {
      if (opener?.isConnected && opener !== document.body) opener.focus({ preventScroll: true });
    });
  }

  /** Moves focus to the title, e.g. when the content it was on has been replaced. */
  focusTitle(): void {
    this.heading()?.nativeElement.focus({ preventScroll: true });
  }

  onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closed.emit();
      return;
    }
    if (event.key !== 'Tab') return;
    const panel = this.panel()?.nativeElement;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.getClientRects().length > 0,
    );
    if (!items.length) {
      event.preventDefault();
      this.focusTitle();
      return;
    }
    const active = document.activeElement as HTMLElement | null;
    const first = items[0];
    const last = items[items.length - 1];
    const inside = !!active && panel.contains(active) && items.includes(active);
    if (event.shiftKey && (!inside || active === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!inside || active === last)) {
      event.preventDefault();
      first.focus();
    }
  }
}
