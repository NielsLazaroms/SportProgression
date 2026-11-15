import { Component, input } from '@angular/core';

/**
 * The Iron Pulse mark: a dumbbell whose bar is a heartbeat line. Drawn in the
 * current text colour, so it follows the theme. Same shape as `public/icon.svg`.
 *
 *   <app-logo [size]="26" />
 */
@Component({
  selector: 'app-logo',
  standalone: true,
  host: { class: 'inline-flex shrink-0' },
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      [attr.width]="size()"
      [attr.height]="size()"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="1.5" y="10" width="3" height="12" rx="1.4" />
      <rect x="5.5" y="5" width="6" height="22" rx="2.2" />
      <rect x="20.5" y="5" width="6" height="22" rx="2.2" />
      <rect x="27.5" y="10" width="3" height="12" rx="1.4" />
      <polyline
        points="11.5,16 13.4,16 14.9,9 17.1,23 18.6,16 20.5,16"
        fill="none"
        stroke="currentColor"
        stroke-width="2.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `,
})
export class AppLogo {
  readonly size = input(26);
}
