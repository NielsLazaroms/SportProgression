import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MnAlertOutletComponent, MnLanguageService } from 'mn-angular-lib';
import { ThemeService } from './shared/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MnAlertOutletComponent],
  template: `
    <router-outlet />
    <mn-alert-outlet />
  `,
})
export class App {
  constructor() {
    // Applies the saved / system theme and keeps following OS changes.
    inject(ThemeService);
    // Keep <html lang> in step with the chosen language (startup and switch),
    // so screen readers and hyphenation use the right one.
    inject(MnLanguageService).locale$.subscribe((locale) => {
      document.documentElement.lang = locale;
    });
  }
}
